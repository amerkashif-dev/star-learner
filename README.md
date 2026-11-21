# Star Learner v2 — put it on her iPhone & tablet

Spoken reading + math practice for a kindergartener. Works offline once installed. No ads, no accounts, no tracking; progress stays on each device.

## Easiest: GitHub Pages (free, ~5 minutes)
1. Create a new public repo (e.g. `star-learner`) on github.com.
2. Upload every file in this folder (index.html, sw.js, manifest.webmanifest, icon-*.png).
3. Repo → Settings → Pages → Source: "Deploy from a branch", Branch: `main` / root → Save.
4. Your link appears in a minute: `https://<your-username>.github.io/star-learner/`

(Netlify Drop also works: drag this folder onto app.netlify.com/drop.)

## Install on each device
1. Open the link in **Safari** (not Chrome) on her iPhone / iPad.
2. Tap **Share → Add to Home Screen → Add**.
3. Open it once while online so it caches for offline use.
4. Volume up, Silent switch off — every instruction is spoken.
5. Optional: Settings → Accessibility → **Guided Access** keeps her inside the app.

## 3D (v3)
Star Island home, Count & Drop, 3D Shapes and Where Is It? are built with three.js 0.186.1, bundled into `three3d.js` (source in the Claude workspace: three3d/src). It only loads when needed. Devices without WebGL automatically get the regular 2D games.

## Grown-ups panel
Tap "For grown-ups" (bottom of home) and answer the addition question. Set her display name, daily break timer, view per-game levels and first-try accuracy, and use **Copy backup / Load backup** to move progress between devices.

## Updating
Replace index.html and bump `VERSION` in sw.js so devices pick up the new copy.
