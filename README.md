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
- Build command: `npm run build`
- Output directory: `dist`

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
