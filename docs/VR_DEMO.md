# ImmichVR Demo Mode

ImmichVR includes a **Demo Mode** that allows the frontend to run without a backend, using mock data and external assets.

## 1. Running Locally (Demo Mode)

You can run the app with mock data locally:

```bash
# In services/frontend
VITE_DEMO_MODE=true npm run dev
```

The app will load mock data from `src/services/api.js` (intercepted) and `src/services/mockData.js`.

## 2. External Assets

To keep the repository small, large demo assets (Gaussian Splats `.ply`) are **not stored in git**. 
They are hosted externally on GitHub Releases.

- **Mock Data Config**: `src/services/mockData.js` points to the external URL.
- **Current URL**: `https://github.com/Papyszoo/ImmichVR/releases/download/assets`

## 3. Automated Deployment

A GitHub Actions workflow (`.github/workflows/demo-deploy.yml`) automatically deploys the demo to GitHub Pages.

**Trigger:**
- Pushing to `main` branch.
- Manual workflow dispatch.

**Process:**
1.  Builds the app in Demo Mode (`build:demo`).
2.  Deploys the `build` output to the `gh-pages` branch.
3.  The app becomes available at `https://papyszoo.github.io/ImmichVR/`.
