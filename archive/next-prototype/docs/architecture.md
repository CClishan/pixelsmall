# PixelSmall Architecture

## Deployment model

- Repository source of truth: Git
- Hosting target: Vercel
- Runtime model: static frontend
- Compression execution: browser-side only

## App flow

1. User opens the web app.
2. User uploads images or a PDF.
3. Browser reads the file locally.
4. Compression libraries run with the uploader's CPU and memory.
5. Compressed output is generated as a browser Blob.
6. User downloads the result directly from the current tab.

## Technical choices

### Images

- Library: `browser-image-compression`
- Why: easy browser integration, configurable output format and built-in web worker support

### PDF

- Libraries: `pdfjs-dist` + `pdf-lib`
- Why: `pdfjs-dist` can render each page to canvas, then `pdf-lib` can package compressed page images back into a downloadable PDF

## Risks

- Large PDFs can consume significant memory in the browser
- Mobile devices may struggle with long or high-resolution documents
- Rasterizing text/vector PDFs can trade searchability for size reduction

## Next engineering steps

- Add drag-and-drop affordances
- Move PDF work into a dedicated worker path if UI blocking appears
- Add end-to-end tests for upload, compress and download flows
- Add analytics/error reporting that excludes file contents
