import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedDemos } from "@/lib/demos";
import { getCampaign, type Campaign } from "@/lib/store";

export const Route = createFileRoute("/print/$id")({
  head: () => ({
    meta: [
      { title: "Printable campaign flyer — Groove AR" },
      { name: "description", content: "Print a flyer with the album artwork and scan QR code." },
      { property: "og:title", content: "Printable campaign flyer — Groove AR" },
      { property: "og:description", content: "Album artwork plus scan-to-play QR code." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintPage,
});

function PrintPage() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Campaign | null>();
  const [qr, setQr] = useState("");
  useEffect(() => {
    seedDemos().then(() => getCampaign(id)).then((x) => setC(x ?? null));
    QRCode.toDataURL(`${window.location.origin}/scan/${id}`, { width: 600, margin: 1 }).then(setQr);
  }, [id]);

  if (!c) return <div className="p-10 text-muted-foreground">{c === null ? "Not found" : "Loading…"}</div>;

  return (
    <main className="min-h-screen p-6 print:p-0">
      <div className="mx-auto mb-6 flex max-w-[560px] justify-between print:hidden">
        <Button variant="ghost" asChild><Link to="/studio/$id" params={{ id }}><ArrowLeft /> Studio</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Print flyer</Button>
      </div>
      <article className="mx-auto max-w-[560px] overflow-hidden rounded-3xl border bg-card print:rounded-none print:border-0">
        <img src={c.targetImage} alt={c.name} className="block w-full" />
        <div className="flex items-center gap-6 p-8">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Scan to play</p>
            <h1 className="mt-1 text-3xl font-black leading-tight">{c.name}</h1>
            <p className="text-sm text-muted-foreground">{c.artist}</p>
            <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Scan the QR with your phone camera</li>
              <li>Allow camera access</li>
              <li>Point it at the cover and watch it come alive</li>
            </ol>
          </div>
          {qr && <img src={qr} alt="QR code" className="w-36 rounded-lg bg-foreground p-2" />}
        </div>
      </article>
    </main>
  );
}
