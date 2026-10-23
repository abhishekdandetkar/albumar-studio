import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, ScanLine, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { seedDemos } from "@/lib/demos";
import { getCampaign, getMind, saveMind, type Campaign, type Layer } from "@/lib/store";
import { compileTarget, loadAframe } from "@/lib/mindar";
import { createPlayer, type Player } from "@/lib/audio";

export const Route = createFileRoute("/scan/$id")({
  head: () => ({
    meta: [
      { title: "Scan the album — Groove AR" },
      { name: "description", content: "Point your camera at the album cover to unlock the AR experience." },
      { property: "og:title", content: "Scan the album — Groove AR" },
      { property: "og:description", content: "Point your camera at the cover to make it play." },
    ],
  }),
  component: Scan,
});

type Phase = "intro" | "preparing" | "searching" | "found" | "denied" | "error" | "missing";

const esc = (s: string) => s.replace(/"/g, "&quot;").replace(/;/g, "%3B");

function layerHtml(l: Layer, i: number) {
  const w = l.w * l.scale;
  const wrap = (inner: string) =>
    `<a-entity position="${l.x} ${l.y} ${0.01 * (i + 1)}" rotation="0 0 ${l.rotation}">${inner}</a-entity>`;
  switch (l.type) {
    case "video": {
      const mat = l.chroma?.enabled
        ? `shader: chromakey; src: #v-${l.id}; color: ${l.chroma.color}; threshold: ${l.chroma.threshold}; opacity: ${l.opacity}`
        : `src: #v-${l.id}; transparent: true; opacity: ${l.opacity}`;
      return wrap(`<a-plane class="vplane" data-vid="v-${l.id}" width="${w}" height="${w * 0.5625}" material="${mat}"></a-plane>`);
    }
    case "image":
      return l.src ? wrap(`<a-image src="#i-${l.id}" width="${w}" height="${w}" opacity="${l.opacity}"></a-image>`) : "";
    case "model":
      if (l.modelKind === "sleeve")
        return wrap(`<a-box src="#cover" width="${w}" height="${w}" depth="0.02" opacity="${l.opacity}" ${l.spin ? `animation="property: rotation; from: 0 -25 0; to: 0 25 0; dir: alternate; loop: true; dur: 2000; easing: easeInOutSine"` : ""}></a-box>`);
      return wrap(`<a-entity ${l.spin ? `animation="property: rotation; to: 0 0 -360; loop: true; dur: 3000; easing: linear"` : ""}>
        <a-cylinder radius="${w / 2}" height="0.01" rotation="90 0 0" color="#111" opacity="${l.opacity}" segments-radial="64"></a-cylinder>
        <a-cylinder radius="${w * 0.18}" height="0.012" rotation="90 0 0" src="#cover" opacity="${l.opacity}" segments-radial="48"></a-cylinder>
      </a-entity>`);
    case "cta":
      return wrap(`<a-plane width="${w}" height="${w / 4}" color="${l.color}" opacity="${l.opacity}"></a-plane>
        <a-text value="${esc(l.label ?? "")}" align="center" color="#111" width="${w * 2.4}" position="0 0 0.005"></a-text>`);
    default:
      return "";
  }
}

function Scan() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Campaign | null>();
  const [phase, setPhase] = useState<Phase>("intro");
  const [progress, setProgress] = useState(0);
  const holder = useRef<HTMLDivElement>(null);
  const players = useRef<Player[]>([]);

  useEffect(() => {
    seedDemos().then(() => getCampaign(id)).then((x) => {
      setC(x ?? null);
      if (!x) setPhase("missing");
    });
  }, [id]);

  useEffect(
    () => () => {
      players.current.forEach((p) => p.dispose());
      const scene = holder.current?.querySelector("a-scene") as any;
      try { scene?.systems?.["mindar-image-system"]?.stop(); } catch { /* noop */ }
      document.querySelectorAll("video").forEach((v) => {
        const s = v.srcObject as MediaStream | null;
        s?.getTracks().forEach((t) => t.stop());
      });
      if (holder.current) holder.current.innerHTML = "";
    },
    [],
  );

  const start = async () => {
    if (!c) return;
    setPhase("preparing");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      setPhase("denied");
      return;
    }
    try {
      const [, mind] = await Promise.all([
        loadAframe(),
          (async () => {
          let m: ArrayBuffer | undefined = await getMind(c.id);
          if (!m && c.mindUrl) {
            try {
              const res = await fetch(c.mindUrl);
              if (res.ok) {
                m = await res.arrayBuffer();
                await saveMind(c.id, m, false); // device-local cache only
              }
            } catch {
              /* falls through to on-device compile */
            }
          }
          if (!m) {
            m = (await compileTarget(c.targetImage, setProgress)).buffer;
            await saveMind(c.id, m);
          }
          return m;
        })(),
      ]);
      players.current = c.layers.filter((l) => l.type === "audio" && l.visible && l.src).map((l) => createPlayer(l.src!, l.loop));
      mount(c, URL.createObjectURL(new Blob([mind])));
      setPhase("searching");
    } catch (e) {
      console.error(e);
      setPhase("error");
    }
  };

  const mount = (c: Campaign, mindUrl: string) => {
    const vis = c.layers.filter((l) => l.visible);
    const assets = [
      `<img id="cover" src="${c.targetImage}" crossorigin="anonymous" />`,
      ...vis.filter((l) => l.type === "video" && l.src).map((l) => `<video id="v-${l.id}" src="${l.src}" crossorigin="anonymous" muted playsinline webkit-playsinline ${l.loop ? "loop" : ""}></video>`),
      ...vis.filter((l) => l.type === "image" && l.src).map((l) => `<img id="i-${l.id}" src="${l.src}" crossorigin="anonymous" />`),
    ].join("");
    holder.current!.innerHTML = `
      <a-scene mindar-image="imageTargetSrc: ${mindUrl}; uiScanning: no; uiLoading: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.001"
        color-space="sRGB" renderer="colorManagement: true" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false" embedded>
        <a-assets timeout="4000">${assets}</a-assets>
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        <a-entity id="ar-target" mindar-image-target="targetIndex: 0">
          ${vis.filter((l) => l.type !== "audio").map(layerHtml).join("")}
        </a-entity>
      </a-scene>`;
    const scene = holder.current!.querySelector("a-scene")!;
    const target = holder.current!.querySelector("#ar-target")!;
    const vids = () => Array.from(holder.current!.querySelectorAll("a-assets video")) as HTMLVideoElement[];
    vids().forEach((v) =>
      v.addEventListener("loadedmetadata", () => {
        const plane = holder.current?.querySelector(`[data-vid="${v.id}"]`) as any;
        const w = Number(plane?.getAttribute("width"));
        if (plane && v.videoWidth) plane.setAttribute("height", (w * v.videoHeight) / v.videoWidth);
      }),
    );
    scene.addEventListener("arError", () => setPhase("error"));
    target.addEventListener("targetFound", () => {
      setPhase("found");
      vids().forEach((v) => v.play().catch(() => {}));
      players.current.forEach((p) => p.play());
    });
    target.addEventListener("targetLost", () => {
      setPhase("searching");
      vids().forEach((v) => v.pause());
      players.current.forEach((p) => p.pause());
    });
  };

  const ctas = c?.layers.filter((l) => l.type === "cta" && l.visible) ?? [];
  const active = phase === "searching" || phase === "found";

  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <div ref={holder} className="absolute inset-0 [&_a-scene]:!absolute [&_a-scene]:!inset-0 [&_video]:object-cover" />

      {active && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-between p-5">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${phase === "found" ? "bg-success text-accent-foreground" : "bg-secondary/90"}`}>
            {phase === "found" ? "● Locked on" : "Searching for the cover…"}
          </span>
          {phase === "searching" && c && (
            <div className="relative w-[70%] max-w-xs rounded-2xl border-2 border-dashed border-accent" style={{ aspectRatio: `1 / ${c.aspect}` }}>
              <img src={c.targetImage} alt="" className="h-full w-full rounded-2xl object-cover opacity-25" />
              <div className="absolute inset-x-0 h-0.5 animate-scanline bg-accent shadow-glow" />
            </div>
          )}
          <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
            {phase === "searching" && <p className="rounded-lg bg-background/80 p-2 text-center text-xs">Fill the frame with the whole cover. Good light, hold steady, avoid glare.</p>}
            {phase === "found" && players.current.length > 0 && <p className="flex items-center justify-center gap-1 text-xs"><Volume2 className="h-3.5 w-3.5" /> Now playing</p>}
            {phase === "found" && ctas.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="rounded-full py-3 text-center font-display text-sm font-bold shadow-glow" style={{ background: l.color, color: "oklch(0.12 0 0)" }}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {!active && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            {c && <img src={c.targetImage} alt={c.name} className="mx-auto mb-6 w-40 rounded-xl shadow-glow" />}
            {phase === "intro" && c && (
              <>
                <h1 className="text-2xl font-black">{c.name}</h1>
                <p className="mb-6 text-sm text-muted-foreground">{c.artist}</p>
                <Button size="lg" className="w-full" onClick={start}><Camera /> Start AR experience</Button>
                <p className="mt-4 text-xs text-muted-foreground">We'll ask for camera access. Point it at the physical cover — sound will play, so turn your volume up.</p>
              </>
            )}
            {phase === "preparing" && (
              <div className="space-y-3">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Preparing the tracker…</p>
                {progress > 0 && progress < 100 && <Progress value={progress} />}
              </div>
            )}
            {phase === "denied" && (
              <div className="space-y-3">
                <CameraOff className="mx-auto h-8 w-8 text-destructive" />
                <h2 className="font-bold">Camera access needed</h2>
                <p className="text-sm text-muted-foreground">Allow the camera in your browser's site settings (tap the lock icon in the address bar), then try again. On iPhone use Safari.</p>
                <Button onClick={start} className="w-full">Try again</Button>
              </div>
            )}
            {phase === "error" && (
              <div className="space-y-3">
                <h2 className="font-bold">AR couldn't start</h2>
                <p className="text-sm text-muted-foreground">Your browser may not support WebGL camera AR. Try Chrome on Android or Safari on iOS.</p>
                <Button onClick={() => window.location.reload()} className="w-full">Reload</Button>
                <Button variant="ghost" asChild className="w-full"><Link to="/studio/$id" params={{ id }}><ScanLine /> Try the simulator instead</Link></Button>
              </div>
            )}
            {phase === "missing" && (
              <div className="space-y-3">
                <h2 className="font-bold">Album not found</h2>
                <p className="text-sm text-muted-foreground">This link doesn't point to a published album. Try one of the demo albums.</p>
                <Button asChild className="w-full"><Link to="/scan/$id" params={{ id: "demo-night-drive" }} reloadDocument>Scan the Night Drive demo</Link></Button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
