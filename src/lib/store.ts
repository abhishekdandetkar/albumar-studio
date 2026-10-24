import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LayerType = "video" | "audio" | "model" | "cta" | "image";

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  src?: string; // data URL, remote URL, app asset URL, or "synth:nightdrive"
  x: number; // target-width units, 0 = center
  y: number;
  w: number; // width as fraction of target width
  scale: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  visible: boolean;
  loop?: boolean;
  chroma?: { enabled: boolean; color: string; threshold: number };
  label?: string;
  url?: string;
  color?: string;
  modelKind?: "vinyl" | "sleeve";
  spin?: boolean;
}

export interface Quality {
  score: number;
  contrast: number;
  density: number;
  features: number;
}

export interface Campaign {
  id: string;
  name: string;
  artist: string;
  kind: "vinyl" | "album" | "photo";
  targetImage: string;
  aspect: number; // height / width
  quality?: Quality | undefined;
  layers: Layer[];
  isDemo?: boolean;
  mindUrl?: string | undefined;
  createdAt: number;
  updatedAt: number;
}

const C = (id: string) => `campaign:${id}`;
const M = (id: string) => `mind:${id}`;

export const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* Cloud-backed store.                                                 */
/* - Demo campaigns live device-local in IndexedDB (bundled artwork).  */
/* - User campaigns live in Lovable Cloud; media + .mind targets are   */
/*   uploaded to the private "ar-assets" bucket and served to any      */
/*   phone through /api/public/assets/*.                               */
/* ------------------------------------------------------------------ */

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];

function rowToCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id,
    name: r.name,
    artist: r.artist,
    kind: r.kind as Campaign["kind"],
    targetImage: r.target_image,
    aspect: r.aspect,
    quality: (r.quality as Quality | null) ?? undefined,
    layers: (r.layers as Layer[] | null) ?? [],
    mindUrl: r.mind_url ?? undefined,
    createdAt: Date.parse(r.created_at),
    updatedAt: Date.parse(r.updated_at),
  };
}

type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];

function toRow(c: Campaign, ownerId: string): CampaignInsert {
  return {
    id: c.id,
    owner_id: ownerId,
    name: c.name,
    artist: c.artist,
    kind: c.kind,
    target_image: c.targetImage,
    aspect: c.aspect,
    quality: (c.quality ?? null) as unknown as CampaignInsert["quality"] & NonNullable<unknown>,
    layers: c.layers as unknown as NonNullable<CampaignInsert["layers"]>,
    mind_url: c.mindUrl ?? null,
    created_at: new Date(c.createdAt || Date.now()).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function ext(dataUrl: string): string {
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "";
  const sub = mime.split("/")[1] ?? "";
  const map: Record<string, string> = { jpeg: "jpg", "svg+xml": "svg", quicktime: "mov", "x-m4a": "m4a" };
  const raw = map[sub] ?? sub;
  return `.${raw || "bin"}`;
}

async function uploadAsset(path: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase.storage
    .from("ar-assets")
    .upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return `/api/public/assets/${path}`;
}

async function uploadMind(id: string, buf: ArrayBuffer, ownerId: string): Promise<string> {
  const path = `${ownerId}/${id}/target.mind`;
  const { error } = await supabase.storage.from("ar-assets").upload(path, new Blob([buf], { type: "application/octet-stream" }), {
    upsert: true,
    contentType: "application/octet-stream",
  });
  if (error) throw new Error(error.message);
  const url = `/api/public/assets/${path}`;
  await supabase.from("campaigns").update({ mind_url: url }).eq("id", id);
  return url;
}

async function sessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const all = (await keys()).filter((k) => String(k).startsWith("campaign:"));
  const locals = (await Promise.all(all.map((k) => get<Campaign>(k)))).filter(Boolean) as Campaign[];
  const demos = locals.filter((c) => c.isDemo);
  const legacy = locals.filter((c) => !c.isDemo);

  let mine: Campaign[] = [];
  const ownerId = await sessionUserId();
  if (ownerId) {
    // Campaigns created before the cloud existed: push them up once, then drop the local copy.
    for (const c of legacy) {
      try {
        await saveCampaign(c);
        await del(C(c.id));
      } catch {
        /* stays local; retried on the next load */
      }
    }
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });
    if (!error && data) mine = data.map(rowToCampaign);
  }

  const items = [...demos, ...mine];
  return items.sort((a, b) => {
    if (a.isDemo !== b.isDemo) return a.isDemo ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  const local = await get<Campaign>(C(id));
  if (local) return local;
  const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (error || !data) return undefined;
  return rowToCampaign(data);
}

export async function saveCampaign(c: Campaign) {
  if (c.isDemo) {
    await set(C(c.id), { ...c, updatedAt: Date.now() });
    return;
  }
  const ownerId = await sessionUserId();
  if (!ownerId) {
    // Signed out (or offline): keep device-local so nothing is lost.
    await set(C(c.id), { ...c, updatedAt: Date.now() });
    return;
  }
  const next: Campaign = { ...c, layers: c.layers.map((l) => ({ ...l })) };
  if (next.targetImage.startsWith("data:"))
    next.targetImage = await uploadAsset(`${ownerId}/${c.id}/cover${ext(next.targetImage)}`, next.targetImage);
  for (const l of next.layers)
    if (l.src?.startsWith("data:")) l.src = await uploadAsset(`${ownerId}/${c.id}/${l.id}${ext(l.src)}`, l.src);

  const { error } = await supabase.from("campaigns").upsert(toRow(next, ownerId));
  if (error) throw new Error(error.message);

  const buf = await get<ArrayBuffer>(M(c.id));
  if (buf) {
    try {
      next.mindUrl = await uploadMind(c.id, buf, ownerId);
    } catch {
      /* target stays device-local; recompiled per device otherwise */
    }
  }
}

export async function deleteCampaign(id: string) {
  await del(C(id));
  await del(M(id));
  const ownerId = await sessionUserId();
  if (!ownerId) return;
  await supabase.from("campaigns").delete().eq("id", id).eq("owner_id", ownerId);
  try {
    const folder = `${ownerId}/${id}`;
    const { data: objs } = await supabase.storage.from("ar-assets").list(folder);
    if (objs?.length) await supabase.storage.from("ar-assets").remove(objs.map((o) => `${folder}/${o.name}`));
  } catch {
    /* best effort cleanup */
  }
}

export const getMind = (id: string) => get<ArrayBuffer>(M(id));

export async function saveMind(id: string, buf: ArrayBuffer, cloud = true) {
  await set(M(id), buf);
  if (!cloud || id.startsWith("demo-")) return;
  const ownerId = await sessionUserId();
  if (!ownerId) return;
  try {
    await uploadMind(id, buf, ownerId);
  } catch {
    /* cached device-local only */
  }
}

export const clearMind = (id: string) => del(M(id));

export function newLayer(type: LayerType, extra: Partial<Layer> = {}): Layer {
  const base: Layer = {
    id: uid(),
    type,
    name: type[0]!.toUpperCase() + type.slice(1),
    x: 0,
    y: 0,
    w: 0.8,
    scale: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
  };
  if (type === "video") Object.assign(base, { name: "Video overlay", loop: true, chroma: { enabled: false, color: "#00ff00", threshold: 0.4 } });
  if (type === "audio") Object.assign(base, { name: "Track audio", loop: true, w: 0 });
  if (type === "model") Object.assign(base, { name: "Spinning vinyl", modelKind: "vinyl", spin: true, w: 0.7 });
  if (type === "cta") Object.assign(base, { name: "CTA badge", label: "Stream on Spotify", url: "https://open.spotify.com", color: "#1ed760", w: 0.5, y: -0.6 });
  if (type === "image") Object.assign(base, { name: "Image", w: 0.5 });
  return { ...base, ...extra };
}

export function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
