# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StreamFlow is a low-latency live streaming platform using WebRTC (WHIP/WHEP), RTMP, and HLS. It runs as a Docker Compose stack with four services: React frontend, Node.js API, MediaMTX media server, and Nginx reverse proxy.

## Commands

### Run the full stack
```bash
docker compose up --build -d
```
Access at `http://localhost`. RTMP ingest on port 1935.

### Run frontend locally (dev mode)
```bash
cd frontend && npm install && npm run dev
```
Vite dev server proxies `/api` to `localhost:3001` and `/hls` to `localhost:8888`.

### Run backend locally (dev mode)
```bash
cd backend && npm install && npm run dev
```
Uses `node --watch` for auto-restart. Requires `MEDIAMTX_API` env var (defaults to `http://mediamtx:9997`).

### Build frontend for production
```bash
cd frontend && npm run build
```
Output goes to `frontend/dist/`.

## Architecture

### Service Communication (all via Docker network)
- **Nginx** (port 80) is the single HTTP entry point. It routes:
  - `/api/*` → Node.js backend (port 3001)
  - `/hls/*` → MediaMTX HLS (port 8888), stripping the `/hls` prefix
  - `/webrtc/*` → MediaMTX WHIP/WHEP (port 8889), stripping the `/webrtc` prefix
  - `/*` → React frontend (port 80)
- **MediaMTX** handles all media: RTMP ingest (1935), HLS delivery (8888), WebRTC signaling (8889), ICE/UDP (8189), and internal API (9997)
- **Backend** polls `MediaMTX API /v3/paths/list` to discover active streams and exposes them at `GET /api/streams`

### WebRTC Flow
- **Broadcasting (WHIP):** `Broadcaster.jsx` captures webcam via `getUserMedia()`, creates an `RTCPeerConnection`, sends SDP offer to `POST /webrtc/{key}/whip`, receives SDP answer from MediaMTX
- **Viewing (WHEP):** `VideoPlayer.jsx` creates a receive-only `RTCPeerConnection`, sends SDP offer to `POST /webrtc/{name}/whep`, falls back to HLS.js if WebRTC fails
- ICE candidates exchange happens over UDP port 8189 directly between browser and MediaMTX

### Frontend Structure
- `App.jsx` — Main component with two modes: `watch` (stream grid + player) and `broadcast`. Polls `/api/streams` every 5 seconds. Contains `StreamCard`, `EmptyState`, and `StreamSetupModal` as inline components.
- `components/Broadcaster.jsx` — WebRTC WHIP publisher with camera preview
- `components/VideoPlayer.jsx` — WebRTC WHEP viewer with automatic HLS fallback
- No router library; mode switching is state-driven (`viewMode` state)
- Styling is in a single `index.css` file using CSS custom properties (dark theme)

### Backend Structure
- `src/index.js` — Express server entry point with `/health` and `/api/streams` routes
- `src/routes/streams.js` — Single route that fetches active paths from MediaMTX API, filters to those with an active publisher (`path.ready === true`), and returns stream metadata including HLS/WebRTC URLs

### Key Configuration Files
- `media-server/mediamtx.yml` — MediaMTX config. `webrtcICEHostNAT1To1IPs` must match the host's reachable IP for WebRTC to work. Auth is set to anonymous for local dev.
- `nginx/nginx.conf` — Reverse proxy routing and CORS headers for WebRTC SDP exchange and HLS segments
- `docker-compose.yml` — Service definitions and port mappings

## Debugging WebRTC Issues
- Check `webrtcICEHostNAT1To1IPs` in `media-server/mediamtx.yml` matches your machine's LAN IP
- Ensure UDP port 8189 is accessible (not blocked by firewall/VPN)
- Browser console shows ICE Gathering State, Connection State, and Signaling State logs
