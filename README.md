# StreamFlow 🎬

A production-grade web-based **live streaming platform** powered by **MediaMTX**, **Node.js**, **React + HLS.js**, and **Nginx** — all orchestrated with **Docker Compose**.

## Architecture

```
[OBS / VLC]  ──RTMP──▶  [MediaMTX :1935]  ──HLS──▶  [Nginx :80]  ──▶  [Browser]
                               │                           │
                               └── API :9997 ──▶  [Node.js API]  ◀──  [React App]
```

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- OBS Studio or VLC (as the streaming source)

### 1. Start the stack

```bash
docker compose up --build
```

Open [http://localhost](http://localhost) in your browser.

### 2. Start streaming

Open **OBS Studio** → Settings → Stream:

| Field | Value |
|---|---|
| Service | Custom |
| Server | `rtmp://localhost:1935/live` |
| Stream Key | `mystream` (or any name) |

Click **Start Streaming** — your stream appears on the dashboard in seconds.

**Using VLC:**
```
Media → Stream → select source → Stream
Output: RTMP → rtmp://localhost:1935/live/mystream
```

## Development (without Docker)

```bash
# Terminal 1: Start MediaMTX
docker run --rm -p 1935:1935 -p 8888:8888 -p 9997:9997 \
  -v ./media-server/mediamtx.yml:/mediamtx.yml \
  bluenviron/mediamtx:latest

# Terminal 2: Start backend
cd backend && npm install && npm run dev

# Terminal 3: Start frontend (proxies /api and /hls automatically)
cd frontend && npm install && npm run dev
```

## Horizontal Scaling

Scale the backend to 3 instances (zero config changes needed):

```bash
docker compose up --scale backend=3
```

## Project Structure

```
streaming-app/
├── docker-compose.yml
├── media-server/mediamtx.yml   ← RTMP/HLS server config
├── backend/                    ← Node.js + Express API
├── frontend/                   ← React + HLS.js SPA
└── nginx/nginx.conf            ← Reverse proxy
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend API port |
| `MEDIAMTX_API` | `http://mediamtx:9997` | MediaMTX internal API URL |
