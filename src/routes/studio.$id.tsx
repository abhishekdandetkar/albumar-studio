import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  ArrowLeft, Box, Copy, Cpu, Download, Eye, EyeOff, Image as ImageIcon, Music, Printer, RotateCcw, ScanLine, Trash2, Video, MousePointerClick, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayerStage } from "@/components/LayerView";
import { clearMind, getCampaign, getMind, newLayer, readFile, saveCampaign, saveMind, type Campaign, type Layer, type LayerType } from "@/lib/store";
import { analyzeImage, compileTarget, loadImage, qualityScore } from "@/lib/mindar";
import { createPlayer, type Player } from "@/lib/audio";

export const Route = createFileRoute("/studio/$id")({
  head: () => ({
    meta: [
      { title: "Campaign Studio — Groove AR" },
      { name: "description", content: "Compile targets, edit AR layers, simulate tracking and publish your album campaign." },
      { property: "og:title", content: "Campaign Studio — Groove AR" },
      { property: "og:description", content: "Edit and test your WebAR album campaign." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Studio,
});

function Studio() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Campaign | null | undefined>(undefined);
  const [sel, setSel] = useState<string>();
  const saveT = useRef<number | undefined>(undefined);

  useEffect(() => {
    getCampaign(id).then((x) => setC(x ?? null));
  }, [id]);

  const update = useCallback((fn: (c: Campaign) => Campaign) => {
    setC((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      clearTimeout(saveT.current);
      saveT.current = window.setTimeout(() => saveCampaign(next), 300);
      return next;
    });
  }, []);

  if (c === undefined) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (c === null)
    return (
      <div className="p-10">
        Campaign not found. <Link to="/" className="text-primary underline">Back</Link>
      </div>
    );

  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link to="/"><ArrowLeft /></Link>
        </Button>
        <Input value={c.name} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} className="h-9 w-48 font-display font-bold" />
        <Input value={c.artist} onChange={(e) => update((x) => ({ ...x, artist: e.target.value }))} className="h-9 w-48" />
        <div className="ml-auto">
          <Button size="sm" variant="secondary" asChild>
            <Link to="/scan/$id" params={{ id }}><ScanLine /> Open scanner</Link>
          </Button>
        </div>
      </header>
      <Tabs defaultValue="layers" className="px-4 py-4">
        <TabsList>
          <TabsTrigger value="target">1 · Target</TabsTrigger>
          <TabsTrigger value="layers">2 · Layers</TabsTrigger>
          <TabsTrigger value="sim">3 · Simulate</TabsTrigger>
          <TabsTrigger value="publish">4 · Publish</TabsTrigger>
        </TabsList>
        <TabsContent value="target"><TargetTab c={c} update={update} /></TabsContent>
        <TabsContent value="layers"><LayersTab c={c} update={update} sel={sel} setSel={setSel} /></TabsContent>
        <TabsContent value="sim"><SimTab c={c} /></TabsContent>
        <TabsContent value="publish"><PublishTab c={c} /></TabsContent>
      </Tabs>
    </main>
  );
}

type Upd = (fn: (c: Campaign) => Campaign) => void;

/* ---------- Target compiler ---------- */
function TargetTab({ c, update }: { c: Campaign; update: Upd }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [hasMind, setHasMind] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMind(c.id).then((m) => setHasMind(!!m));
  }, [c.id]);

  const compile = async () => {
    setProgress(0);
    setPoints([]);
    try {
      const [a, r] = await Promise.all([analyzeImage(c.targetImage), compileTarget(c.targetImage, setProgress)]);
      await saveMind(c.id, r.buffer);
      setPoints(r.points);
      setHasMind(true);
      update((x) => ({ ...x, quality: { contrast: a.contrast, density: a.density, features: r.featureCount, score: qualityScore(a.contrast, a.density, r.featureCount) } }));
      toast.success("Target compiled — .mind file ready");
    } catch (e) {
      console.error(e);
      toast.error("Compilation failed. Try a different image.");
    } finally {
      setProgress(null);
    }
  };

  const downloadMind = async () => {
    const m = await getMind(c.id);
    if (!m) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([m]));
    a.download = `${c.name || "target"}.mind`;
    a.click();
  };

  const replace = async (f: File) => {
    const src = await readFile(f);
    const img = await loadImage(src);
    await clearMind(c.id);
    setHasMind(false);
    setPoints([]);
    update((x) => ({ ...x, targetImage: src, aspect: img.height / img.width, quality: undefined }));
  };

  const q = c.quality;
  const rating = q ? (q.score >= 75 ? "Excellent" : q.score >= 55 ? "Good" : q.score >= 35 ? "Fair" : "Poor") : null;

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="relative overflow-hidden rounded-2xl border bg-card">
        <img src={c.targetImage} alt="Target" className="block w-full" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={0.006} className="fill-accent" />
          ))}
        </svg>
        {progress !== null && (
          <div className="absolute inset-x-0 h-0.5 animate-scanline bg-accent shadow-glow" />
        )}
      </div>
      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-1 flex items-center gap-2 font-bold"><Cpu className="h-4 w-4 text-accent" /> In-browser MindAR compiler</h3>
          <p className="mb-4 text-sm text-muted-foreground">Builds the image-tracking .mind file right here — nothing leaves your device.</p>
          {progress !== null ? (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Extracting feature points… {progress.toFixed(0)}%</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={compile}><Cpu /> {hasMind ? "Recompile" : "Compile target"}</Button>
              <Button variant="outline" onClick={downloadMind} disabled={!hasMind}><Download /> .mind file</Button>
              <Button variant="ghost" onClick={() => fileRef.current?.click()}><ImageIcon /> Replace artwork</Button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && replace(e.target.files[0])} />
            </div>
          )}
          {hasMind && progress === null && <p className="mt-3 text-xs text-success">● Compiled target cached on this device</p>}
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 font-bold">Target quality</h3>
          {q ? (
            <>
              <div className="mb-4 flex items-end gap-3">
                <span className="font-display text-5xl font-black text-primary">{q.score}</span>
                <span className="pb-2 text-sm font-bold">{rating}</span>
              </div>
              {[["Contrast", q.contrast], ["Feature density", q.density], ["Tracking features", Math.min(100, Math.round((q.features / 600) * 100))]].map(([k, v]) => (
                <div key={k as string} className="mb-3">
                  <div className="mb-1 flex justify-between text-xs"><span>{k}</span><span className="text-muted-foreground">{v}</span></div>
                  <Progress value={v as number} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{q.features} keypoints detected. Busy, high-contrast art with lots of corners tracks best; avoid large flat areas.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Compile the target to see its rating and tracking points.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- Layers editor ---------- */
const ADD: { t: LayerType; label: string; icon: typeof Video; extra?: Partial<Layer> }[] = [
  { t: "video", label: "Video", icon: Video },
  { t: "audio", label: "Audio", icon: Music },
  { t: "model", label: "3D vinyl", icon: Box },
  { t: "model", label: "3D sleeve", icon: Box, extra: { modelKind: "sleeve", name: "Spinning sleeve" } },
  { t: "cta", label: "CTA badge", icon: MousePointerClick },
  { t: "image", label: "Image", icon: ImageIcon },
];
const CTA_PRESETS = [
  { label: "Stream on Spotify", color: "#1ed760", url: "https://open.spotify.com" },
  { label: "Buy Vinyl", color: "#ff3d9a", url: "https://example.com/shop" },
  { label: "View Tracklist", color: "#7ce8ff", url: "https://example.com/tracklist" },
  { label: "Tour Dates", color: "#f5b942", url: "https://example.com/tour" },
];

function LayersTab({ c, update, sel, setSel }: { c: Campaign; update: Upd; sel?: string | undefined; setSel: (s?: string) => void }) {
  const layer = c.layers.find((l) => l.id === sel);
  const patch = (lid: string, p: Partial<Layer>) => update((x) => ({ ...x, layers: x.layers.map((l) => (l.id === lid ? { ...l, ...p } : l)) }));

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {ADD.map((a) => (
            <Button key={a.label} variant="secondary" size="sm" onClick={() => {
              const l = newLayer(a.t, a.extra);
              update((x) => ({ ...x, layers: [...x.layers, l] }));
              setSel(l.id);
            }}>
              <a.icon /> {a.label}
            </Button>
          ))}
        </div>
        <ul className="space-y-1">
          {[...c.layers].reverse().map((l) => (
            <li key={l.id} onClick={() => setSel(l.id)} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${sel === l.id ? "border-primary bg-primary/10" : "bg-card"}`}>
              <span className="flex-1 truncate">{l.name}</span>
              <button aria-label="Toggle visibility" onClick={(e) => { e.stopPropagation(); patch(l.id, { visible: !l.visible }); }}>
                {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </button>
              <button aria-label="Delete layer" onClick={(e) => { e.stopPropagation(); update((x) => ({ ...x, layers: x.layers.filter((y) => y.id !== l.id) })); }}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
          {!c.layers.length && <li className="text-sm text-muted-foreground">Add your first overlay above.</li>}
        </ul>
      </aside>

      <div className="flex items-start justify-center rounded-2xl border bg-muted/40 p-6" onPointerDown={() => setSel(undefined)}>
        <div className="relative w-full max-w-[520px]" style={{ aspectRatio: `1 / ${c.aspect}` }}>
          <img src={c.targetImage} alt="" className="absolute inset-0 h-full w-full rounded-md object-cover opacity-80" />
          <LayerStage campaign={c} playing selected={sel} onSelect={setSel} onDrag={(lid, x, y) => patch(lid, { x, y })} />
        </div>
      </div>

      <aside className="rounded-2xl border bg-card p-4">
        {!layer ? (
          <p className="text-sm text-muted-foreground">Select a layer to edit. Drag layers on the canvas to position them.</p>
        ) : (
          <LayerProps layer={layer} patch={(p) => patch(layer.id, p)} />
        )}
      </aside>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs"><span className="font-medium">{label}</span><span className="text-muted-foreground">{value}</span></div>
      {children}
    </div>
  );
}

function LayerProps({ layer: l, patch }: { layer: Layer; patch: (p: Partial<Layer>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const accept = l.type === "video" ? "video/*" : l.type === "audio" ? "audio/*" : "image/*";
  return (
    <div className="space-y-5">
      <Input value={l.name} onChange={(e) => patch({ name: e.target.value })} className="font-bold" />
      {(l.type === "video" || l.type === "audio" || l.type === "image") && (
        <div className="space-y-2">
          <Button size="sm" variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>Upload {l.type} file</Button>
          <Input placeholder="…or paste a URL" value={l.src?.startsWith("data:") ? "" : l.src ?? ""} onChange={(e) => patch({ src: e.target.value })} />
          {l.src?.startsWith("synth:") && <p className="text-xs text-muted-foreground">Using built-in demo synth track.</p>}
          <input ref={fileRef} type="file" accept={accept} hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) patch({ src: await readFile(f) }); }} />
        </div>
      )}
      {l.type === "cta" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {CTA_PRESETS.map((p) => (
              <button key={p.label} onClick={() => patch(p)} className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-secondary">{p.label}</button>
            ))}
          </div>
          <Input value={l.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Label" />
          <Input value={l.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://" />
          <Field label="Badge color"><input type="color" value={l.color} onChange={(e) => patch({ color: e.target.value })} className="h-8 w-full rounded" /></Field>
        </div>
      )}
      {(l.type === "video" || l.type === "audio") && (
        <div className="flex items-center justify-between text-sm">Loop <Switch checked={!!l.loop} onCheckedChange={(v) => patch({ loop: v })} /></div>
      )}
      {l.type === "model" && (
        <div className="flex items-center justify-between text-sm">Spin animation <Switch checked={!!l.spin} onCheckedChange={(v) => patch({ spin: v })} /></div>
      )}
      {l.type === "video" && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between text-sm">Green-screen key <Switch checked={!!l.chroma?.enabled} onCheckedChange={(v) => patch({ chroma: { ...l.chroma!, enabled: v } })} /></div>
          {l.chroma?.enabled && (
            <>
              <Field label="Key color"><input type="color" value={l.chroma.color} onChange={(e) => patch({ chroma: { ...l.chroma!, color: e.target.value } })} className="h-8 w-full rounded" /></Field>
              <Field label="Threshold" value={l.chroma.threshold.toFixed(2)}>
                <Slider min={0.05} max={0.9} step={0.01} value={[l.chroma.threshold]} onValueChange={([v = 0]) => patch({ chroma: { ...l.chroma!, threshold: v } })} />
              </Field>
            </>
          )}
        </div>
      )}
      {l.type !== "audio" && (
        <>
          <Field label="Scale" value={l.scale.toFixed(2)}><Slider min={0.1} max={3} step={0.01} value={[l.scale]} onValueChange={([v = 0]) => patch({ scale: v })} /></Field>
          <Field label="Position X" value={l.x.toFixed(2)}><Slider min={-1.5} max={1.5} step={0.01} value={[l.x]} onValueChange={([v = 0]) => patch({ x: v })} /></Field>
          <Field label="Position Y" value={l.y.toFixed(2)}><Slider min={-1.5} max={1.5} step={0.01} value={[l.y]} onValueChange={([v = 0]) => patch({ y: v })} /></Field>
          <Field label="Rotation" value={`${l.rotation}°`}><Slider min={-180} max={180} step={1} value={[l.rotation]} onValueChange={([v = 0]) => patch({ rotation: v })} /></Field>
        </>
      )}
      <Field label="Opacity" value={`${Math.round(l.opacity * 100)}%`}><Slider min={0} max={1} step={0.01} value={[l.opacity]} onValueChange={([v = 0]) => patch({ opacity: v })} /></Field>
    </div>
  );
}

/* ---------- Simulator ---------- */
function SimTab({ c }: { c: Campaign }) {
  const [state, setState] = useState<"idle" | "scanning" | "locked" | "lost">("idle");
  const players = useRef<Player[]>([]);

  useEffect(() => () => players.current.forEach((p) => p.dispose()), []);

  useEffect(() => {
    if (state === "scanning") {
      const t = setTimeout(() => setState("locked"), 1800);
      return () => clearTimeout(t);
    }
    if (state === "locked") {
      if (!players.current.length)
        players.current = c.layers.filter((l) => l.type === "audio" && l.visible && l.src).map((l) => createPlayer(l.src!, l.loop));
      players.current.forEach((p) => p.play());
    } else players.current.forEach((p) => p.pause());
    return undefined;
  }, [state, c.layers]);

  const locked = state === "locked";
  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[auto_1fr]">
      <div className="relative mx-auto h-[640px] w-[320px] overflow-hidden rounded-[44px] border-8 border-secondary bg-background shadow-glow">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,var(--muted),var(--background))]" />
        <div
          className="absolute left-1/2 top-1/2 w-[78%] transition-all duration-[1600ms] ease-out [perspective:900px]"
          style={{
            transform: state === "idle" || state === "lost" ? "translate(-10%,-30%) rotate(-14deg) scale(0.7)" : "translate(-50%,-50%) rotate(0deg) scale(1)",
            opacity: state === "lost" ? 0.4 : 1,
          }}
        >
          <div className="relative [transform:rotateX(12deg)]" style={{ aspectRatio: `1 / ${c.aspect}` }}>
            <img src={c.targetImage} alt="" className="absolute inset-0 h-full w-full rounded-sm object-cover shadow-2xl" />
            {locked && <LayerStage campaign={c} playing />}
          </div>
        </div>
        {state === "scanning" && (
          <div className="absolute inset-x-8 top-[25%] h-[50%] rounded-xl border-2 border-accent/70">
            <div className="absolute inset-x-0 h-0.5 animate-scanline bg-accent shadow-glow" />
          </div>
        )}
        <div className="absolute inset-x-0 top-6 text-center text-xs font-bold">
          <span className={`rounded-full px-3 py-1 ${locked ? "bg-success text-accent-foreground" : "bg-secondary"}`}>
            {state === "idle" ? "Camera ready" : state === "scanning" ? "Searching for cover…" : locked ? "● Target locked" : "Target lost"}
          </span>
        </div>
      </div>
      <div className="max-w-md space-y-4">
        <h3 className="text-lg font-bold">In-studio simulator</h3>
        <p className="text-sm text-muted-foreground">Simulates pointing a phone at the cover: the tracker searches, locks on, and your overlays, audio and CTAs fire exactly as configured.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setState("scanning")} disabled={state === "scanning"}><Smartphone /> {state === "idle" ? "Point camera" : "Rescan"}</Button>
          <Button variant="outline" onClick={() => setState("lost")} disabled={!locked}>Move camera away</Button>
          <Button variant="ghost" onClick={() => setState("idle")}><RotateCcw /> Reset</Button>
        </div>
        <ul className="space-y-1 text-sm">
          {c.layers.map((l) => (
            <li key={l.id} className="flex justify-between rounded border px-3 py-1.5">
              <span>{l.name}</span>
              <span className={locked && l.visible ? "text-success" : "text-muted-foreground"}>{locked && l.visible ? (l.type === "audio" ? "playing" : "showing") : "idle"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Publish ---------- */
function PublishTab({ c }: { c: Campaign }) {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/scan/${c.id}`;
    setUrl(u);
    QRCode.toDataURL(u, { width: 720, margin: 2 }).then(setQr);
  }, [c.id]);

  return (
    <div className="mt-4 grid gap-8 md:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border bg-foreground p-4">{qr && <img src={qr} alt="Scan QR code" className="w-full" />}</div>
      <div className="max-w-lg space-y-4">
        <h3 className="text-lg font-bold">Share your campaign</h3>
        <div className="flex gap-2">
          <Input readOnly value={url} />
          <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><a href={qr} download={`${c.name}-qr.png`}><Download /> Download QR</a></Button>
          <Button variant="outline" asChild><Link to="/print/$id" params={{ id: c.id }}><Printer /> Printable flyer</Link></Button>
          <Button variant="ghost" asChild><Link to="/scan/$id" params={{ id: c.id }}><ScanLine /> Test scanner</Link></Button>
        </div>
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          Campaigns are stored in this browser. Demo albums work on any phone; your own uploads open on this device only until cloud publishing is enabled.
        </p>
      </div>
    </div>
  );
}
