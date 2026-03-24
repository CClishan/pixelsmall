# Archived Next Prototype

This folder keeps a lightweight record of the first Next.js-based PixelSmall prototype.
It is no longer part of the active build, lint, or deployment flow.

## Kept on purpose

- `docs/` - early product and architecture notes
- `reference/compressor-app.tsx` - the main prototype UI implementation
- `reference/compressor-app.module.css` - the prototype visual system
- `reference/image-compress.ts` - image compression helper snapshot
- `reference/pdf-compress.ts` - PDF compression helper snapshot
- `reference/validators.ts` - upload validation snapshot
- `reference/formatters.ts` - queue/result formatting helpers

## Removed from the archive

The following were intentionally removed to keep the archive lightweight:

- Next.js build configuration and package manifests
- static assets copied from scaffolding
- duplicate app routing shell files
- generated outputs and dependency folders

## When to use this archive

Use this archive only as implementation reference when comparing the old Next.js approach with the current Vite app at the repository root.
