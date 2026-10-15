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
- Campaigns, layers and compiled .mind targets live in browser IndexedDB (src/lib/store.ts) — no backend yet; move to Lovable Cloud for cross-device scanning.
- MindAR compiler and A-Frame scanner load from CDN at runtime (src/lib/mindar.ts) — keeps heavy tfjs/three out of the SSR bundle.
- Layer coordinates are in target-width units centered on the cover (y up) — shared by the 2D editor/simulator and the A-Frame AR scene.
