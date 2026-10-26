# Albumar Studio

Build a WebAR SaaS platform for interactive album experiences (vinyl sleeves, music album covers, and photo albums) using MindAR image tracking.

Key features and requirements:
1. Client-Side MindAR Compiler:
   - In-browser target image compilation into MindAR `.mind` files using the MindAR compiler library without requiring a backend server.
   - Show a responsive progress bar, tracking feature point visualization, and target quality rating (contrast/feature density score).

2. Album Campaign Studio:
   - Target image upload (album cover / vinyl artwork).
   - Multi-layer AR overlay manager:
     * Music video or animated artwork overlay (supports play/pause, loop, and green-screen chroma key transparency).
     * Audio playback synced to target detection (track preview / album stream).
     * 3D overlays (spinning vinyl record / sleeve 3D model).
     * Floating interactive CTA badges (e.g. "Stream on Spotify", "Buy Vinyl", "View Tracklist", "Tour Dates").
   - Target canvas editor with transform controls (scale, position X/Y, rotation, opacity).

3. Instant In-Studio Simulator & Testing:
   - Interactive preview mode that simulates pointing a camera at the album cover, triggering tracking lock and playing overlays.

4. Mobile WebAR Scanner:
   - Scannable public viewer route for each campaign (`/scan/:campaignId`).
   - Browser camera access with MindAR image tracking running in real time to lock onto the physical album cover.
   - Smooth fallback and helpful camera permission / alignment guides.

5. QR Publishing & Export:
   - Downloadable QR code and direct share URL for each album campaign.
   - Printable campaign card / flyer layout with the album artwork and scan QR code.

6. Ready-to-Test Demo Albums:
   - Include pre-loaded demo albums (e.g., a synthwave vinyl record with animated cover video and playable track, and a photo album memory) so the user can test the workflow immediately on screen.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://albumar-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0b592fae-4055-46ba-9a13-876a1a53e9b9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
