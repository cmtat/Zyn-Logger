# Soundboard

A simple browser-based soundboard. Upload audio files, then click to play them on demand. Files are stored in your browser (IndexedDB) so they persist between sessions on the same device.

## Run locally

From the `soundboard` directory, start a simple static server, for example with Python:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Features

- Upload multiple audio files at once (supports drag & drop)
- Click tiles to play (overlap is supported)
- Rename or delete sounds
- Global volume control
- Stop all playing sounds

No backend required.