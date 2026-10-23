<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- User campaigns live in Lovable Cloud (public.campaigns; RLS: public read so any phone can scan, owner-only writes). Cover images, layer media and compiled .mind files go to the private "ar-assets" storage bucket and are served cross-device through the /api/public/assets/* route (the workspace blocks public buckets).
- Demo campaigns stay device-local in IndexedDB (src/lib/demos.ts seedDemos) — their artwork is bundled, so they work on any phone without the backend.
- Managing albums requires sign-in (email/password + Google + Sign in with Lovable); studio routes sit under the _authenticated layout. Scan (/scan/$id) and print are public.
- MindAR compiler and A-Frame scanner load from CDN at runtime (src/lib/mindar.ts) — keeps heavy tfjs/three out of the SSR bundle.
- Layer coordinates are in target-width units centered on the cover (y up) — shared by the 2D editor/simulator and the A-Frame AR scene.
