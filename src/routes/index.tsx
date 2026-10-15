import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Disc3, Plus, ScanLine, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedDemos } from "@/lib/demos";
import { deleteCampaign, listCampaigns, readFile, saveCampaign, uid, type Campaign } from "@/lib/store";
import { loadImage } from "@/lib/mindar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Groove AR — Album cover WebAR studio" },
      { name: "description", content: "Compile album art into MindAR targets, layer video, audio, 3D vinyl and CTAs, and publish a scannable QR." },
      { property: "og:title", content: "Groove AR — Album cover WebAR studio" },
      { property: "og:description", content: "Make vinyl sleeves and photo albums come alive with browser AR." },
    ],
  }),
  component: Index,
});

function Index() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  const refresh = () => listCampaigns().then(setItems);
  useEffect(() => {
    seedDemos().then(refresh);
  }, []);

  const create = async (f: File) => {
    const src = await readFile(f);
    const img = await loadImage(src);
    const c: Campaign = {
      id: uid(),
      name: f.name.replace(/\.[^.]+$/, ""),
      artist: "Untitled artist",
      kind: "album",
      targetImage: src,
      aspect: img.height / img.width,
      layers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveCampaign(c);
    nav({ to: "/studio/$id", params: { id: c.id } });
  };

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <Disc3 className="h-6 w-6 text-primary" /> Groove AR
        </div>
        <Button onClick={() => fileRef.current?.click()}>
          <Plus /> New campaign
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-accent">
          <ScanLine className="h-3.5 w-3.5" /> Image-tracked WebAR · no app install
        </p>
        <h1 className="max-w-3xl text-4xl font-black leading-[1.05] md:text-6xl">
          Make every <span className="text-primary">sleeve</span> play when the camera finds it.
        </h1>
        <p className="mt-5 max-w-xl text-muted-foreground">
          Upload a cover, compile it in your browser, stack video, audio, a spinning vinyl and CTA badges on top — then print the QR.
        </p>
        <div className="mt-8 flex gap-3">
          <Button size="lg" onClick={() => fileRef.current?.click()}>
            <Wand2 /> Upload album artwork
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/studio/$id" params={{ id: "demo-night-drive" }}>Open demo studio</Link>
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && create(e.target.files[0])} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-6 text-xl font-bold">Campaigns</h2>
        {!items ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => (
              <article key={c.id} className="group overflow-hidden rounded-2xl border bg-card">
                <Link to="/studio/$id" params={{ id: c.id }} className="block aspect-square overflow-hidden">
                  <img src={c.targetImage} alt={c.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                </Link>
                <div className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold">{c.name}</h3>
                      {c.isDemo && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">DEMO</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.artist} · {c.layers.length} layers</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="secondary" asChild>
                      <Link to="/scan/$id" params={{ id: c.id }}>Scan</Link>
                    </Button>
                    {!c.isDemo && (
                      <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => deleteCampaign(c.id).then(refresh)}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
