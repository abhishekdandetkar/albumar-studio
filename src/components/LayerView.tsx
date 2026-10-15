import { useEffect, useRef } from "react";
import type { Campaign, Layer } from "@/lib/store";

function hexToRgb(h: string) {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function VideoLayer({ layer, playing }: { layer: Layer; playing: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  const c = useRef<HTMLCanvasElement>(null);
  const chroma = layer.chroma?.enabled;

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    if (playing) el.play().catch(() => {});
    else el.pause();
  }, [playing, layer.src]);

  useEffect(() => {
    if (!chroma) return;
    let raf = 0;
    const [r, g, b] = hexToRgb(layer.chroma!.color) as [number, number, number];
    const th = layer.chroma!.threshold * 441;
    const draw = () => {
      const el = v.current, cv = c.current;
      if (el && cv && el.videoWidth) {
        cv.width = 320;
        cv.height = Math.round((320 * el.videoHeight) / el.videoWidth);
        const ctx = cv.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(el, 0, 0, cv.width, cv.height);
        try {
          const img = ctx.getImageData(0, 0, cv.width, cv.height);
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const dist = Math.hypot(d[i]! - r, d[i + 1]! - g, d[i + 2]! - b);
            if (dist < th) d[i + 3] = Math.max(0, ((dist - th * 0.6) / (th * 0.4)) * 255);
          }
          ctx.putImageData(img, 0, 0);
        } catch {
          /* cross-origin video: show unkeyed */
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [chroma, layer.chroma?.color, layer.chroma?.threshold]);

  if (!layer.src)
    return <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/10 text-[10px] text-primary">Upload video</div>;
  return (
    <div className="relative w-full">
      <video
        ref={v}
        src={layer.src}
        crossOrigin="anonymous"
        muted
        playsInline
        loop={layer.loop}
        className={chroma ? "absolute h-px w-px opacity-0" : "block w-full rounded-md shadow-glow"}
      />
      {chroma && <canvas ref={c} className="block w-full" />}
    </div>
  );
}

export function LayerContent({ layer, campaign, playing }: { layer: Layer; campaign: Campaign; playing: boolean }) {
  switch (layer.type) {
    case "video":
      return <VideoLayer layer={layer} playing={playing} />;
    case "image":
      return layer.src ? <img src={layer.src} alt="" className="block w-full" /> : <div className="aspect-square w-full rounded-md border border-dashed border-primary/60 bg-primary/10" />;
    case "model":
      return layer.modelKind === "sleeve" ? (
        <div className="aspect-square w-full [perspective:600px]">
          <img src={campaign.targetImage} alt="" className={`h-full w-full rounded-sm object-cover shadow-glow ${layer.spin && playing ? "animate-sleeve" : ""}`} />
        </div>
      ) : (
        <div className={`relative aspect-square w-full rounded-full shadow-glow ${layer.spin && playing ? "animate-spin-slow" : ""}`} style={{ background: "repeating-radial-gradient(circle, oklch(0.16 0 0) 0 2px, oklch(0.22 0 0) 2px 4px)" }}>
          <img src={campaign.targetImage} alt="" className="absolute left-1/2 top-1/2 h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover" />
          <div className="absolute left-1/2 top-1/2 h-[4%] w-[4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
        </div>
      );
    case "cta":
      return (
        <div className="flex w-full items-center justify-center rounded-full px-2 py-[6%] text-center font-display text-[clamp(8px,2.2cqw,15px)] font-bold leading-none shadow-glow" style={{ background: layer.color, color: "oklch(0.12 0 0)", aspectRatio: "4 / 1" }}>
          {layer.label}
        </div>
      );
    default:
      return null;
  }
}

export function LayerStage({
  campaign,
  playing,
  selected,
  onSelect,
  onDrag,
}: {
  campaign: Campaign;
  playing: boolean;
  selected?: string | undefined;
  onSelect?: (id: string) => void;
  onDrag?: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startDrag = (e: React.PointerEvent, l: Layer) => {
    if (!onDrag || !ref.current) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(l.id);
    const rect = ref.current.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = l.x, oy = l.y;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / rect.width;
      const dy = (ev.clientY - sy) / rect.width;
      onDrag(l.id, +(ox + dx).toFixed(3), +(oy - dy).toFixed(3));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 [container-type:inline-size]">
      {campaign.layers
        .filter((l) => l.visible && l.type !== "audio")
        .map((l) => (
          <div
            key={l.id}
            onPointerDown={(e) => startDrag(e, l)}
            className={`absolute ${onDrag ? "pointer-events-auto cursor-move" : ""} ${selected === l.id ? "outline outline-2 outline-offset-2 outline-accent" : ""} ${l.type === "cta" && !onDrag ? "pointer-events-auto cursor-pointer" : ""}`}
            onClick={() => {
              if (!onDrag && l.type === "cta" && l.url) window.open(l.url, "_blank");
            }}
            style={{
              left: `${50 + l.x * 100}%`,
              top: `${50 - (l.y / campaign.aspect) * 100}%`,
              width: `${l.w * l.scale * 100}%`,
              opacity: l.opacity,
              transform: `translate(-50%,-50%) rotate(${-l.rotation}deg)`,
            }}
          >
            <LayerContent layer={l} campaign={campaign} playing={playing} />
          </div>
        ))}
    </div>
  );
}
