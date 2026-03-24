# PixelSmall PRD

## Product statement

Build an online image and PDF compression tool where uploads are processed in the browser with the user's own local resources, while the app itself is managed in Git and deployed on Vercel.

## MVP goals

- Let users batch-compress JPG, PNG and WebP files
- Let users compress one scanned PDF at a time
- Show original size, output size, savings ratio and download action
- Keep the default workflow frontend-only without backend file storage

## Non-goals for the first release

- OCR
- Cloud file storage
- Account system
- Multi-user history sync
- Guaranteed optimal compression for vector/text PDFs

## Success criteria

- First contentful page loads quickly on Vercel preview deployment
- Compression works in modern desktop browsers
- Users understand that files are processed locally
- The codebase is organized for iterative Git-based delivery
