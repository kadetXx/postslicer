# Slicey

A photo slicer for the X (Twitter) multi-image carousel trick — split any image into equal vertical slices, ready to post.

Live: https://postslicer.com

## How it works

X arranges multiple images in one post as a grid. Slice a single photo into equal vertical strips, upload them to one post in order, and the grid reassembles them into what looks like one continuous image — the "carousel" trick.

Slicey does the slicing: drop in a photo, pick 2 or 3 slices, and download a zip with each strip ready to upload in order.

## Tech

- Vanilla JS, HTML, CSS — no framework, no build step
- Canvas API for slicing images client-side (nothing is uploaded to a server)
- JSZip for bundling the slices into a downloadable zip
- GoatCounter for privacy-friendly analytics

## Getting started

It's static files — no install or build required.

```bash
python3 -m http.server
```

Open http://localhost:8000.

## License

AGPL-3.0 — see [LICENSE](LICENSE).
