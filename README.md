# PixelSmall

PixelSmall is a browser-side image and scanned-PDF compression app.

## Current main app

- Vite + React frontend at the repository root
- Local image compression with `browser-image-compression`
- Local scanned-PDF compression with `pdfjs-dist` + `pdf-lib`
- File-size warnings, PDF page estimation, per-file cancel, queue reorder, and ZIP downloads

## Repository layout

- `src/` - current production UI and compression logic
- `public/` - static brand assets, favicon, OG image, manifest, and crawl files
- `vercel.json` - SPA routing and deployment headers for Vercel
- `archive/next-prototype/` - archived first-pass Next.js prototype kept for reference

## Run locally

```bash
npm install
npm run dev
```

On Windows PowerShell, if `npm` is blocked by execution policy, run:

```powershell
npm.cmd run dev
```

## Build

```bash
npm run build
```

## Deploy to Vercel

- Framework preset: `Vite`
- Root directory: repository root
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js runtime: use Vercel default or current LTS
- Environment variables: none required, because compression runs entirely in the browser

### Recommended Vercel setup

1. Import the GitHub repository into Vercel.
2. Confirm the project uses the repository root as the Root Directory.
3. Keep the detected framework as `Vite`.
4. Verify the build settings match the values above.
5. Add your production domain, then update `public/sitemap.xml` to that final domain.

### Included launch assets

- `public/favicon.svg`
- `public/og-image.svg`
- `public/site.webmanifest`
- `public/robots.txt`
- `public/sitemap.xml`
- `vercel.json`

### Before production launch

1. Update `public/sitemap.xml` with your final production domain.
2. If you add a custom domain, set it in Vercel project settings.
3. If you want a raster social card, replace `public/og-image.svg` with a PNG export later.
4. If the site is served under the main domain, the current SPA rewrite in `vercel.json` already routes deep links back to the app entry.
