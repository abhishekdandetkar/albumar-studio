import { get, set, del, keys } from "idb-keyval";

export type LayerType = "video" | "audio" | "model" | "cta" | "image";

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  src?: string; // data URL, remote URL, or "synth:nightdrive"
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
  quality?: Quality;
  layers: Layer[];
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

const C = (id: string) => `campaign:${id}`;
const M = (id: string) => `mind:${id}`;

export const uid = () => Math.random().toString(36).slice(2, 10);

export async function listCampaigns(): Promise<Campaign[]> {
  const all = (await keys()).filter((k) => String(k).startsWith("campaign:"));
  const items = await Promise.all(all.map((k) => get<Campaign>(k)));
  return (items.filter(Boolean) as Campaign[]).sort((a, b) => {
    if (a.isDemo !== b.isDemo) return a.isDemo ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}
export const getCampaign = (id: string) => get<Campaign>(C(id));
export async function saveCampaign(c: Campaign) {
  await set(C(c.id), { ...c, updatedAt: Date.now() });
}
export async function deleteCampaign(id: string) {
  await del(C(id));
  await del(M(id));
}
export const getMind = (id: string) => get<ArrayBuffer>(M(id));
export const saveMind = (id: string, buf: ArrayBuffer) => set(M(id), buf);
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
