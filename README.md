# StreamFlow 🎬

A production-grade web-based **live streaming platform** powered by **MediaMTX**, **Node.js**, **React + HLS.js**, and **Nginx** — all orchestrated with **Docker Compose**.

## Architecture Deep Dive

```
[Broadcasters]                                  [Cloud / Server]                                  [Viewers]
OBS Studio / FFmpeg                             Docker Compose Stack                              Web Browser
       │                                                 │                                             │
       │    1. RTMP (Port 1935)                          │                                             │
       ├───────────────────────▶ [ MediaMTX ]            │                                             │
       │                         (Ingestion &            │        3. HLS (.m3u8 & .ts files)           │
       │                          Transcoding)           ├───────────────────────────────────────────▶ │
       │                               │                 │                                             │
       │                               │                 │                                             │
       │                  2. API calls │                 │                                             │
       │                 to list active│                 │                                             │
       │                      streams  ▼                 │                                             │
       │                       [ Node.js API ]           │        4. Provide stream metadata           │
       │                         (Port 3001) ────────────┼───────────────────────────────────────────▶ │
       │                                                 │           (via REST JSON API)               │
                                                         │                                             │
                                                         │                                             │
                                   [ Nginx ] ◀───────────┘
                               (Reverse Proxy)
                            Handles CORS & Routing
```

### Component Breakdown
1. **The Broadcasters (OBS, FFmpeg, VLC):** Using the RTMP protocol (the industry standard for low-latency live streaming), your broadcast software pushes a continuous video feed to the server.
2. **MediaMTX:** The core media engine. It receives the RTMP feed on port `1935`, processes it in real-time, and chunks it into 2-second HTTP Live Streaming (HLS) segments served internally on port `8888`. It also exposes an internal monitoring API on port `9997`.
3. **Node.js (Express) API:** The backend service. It routinely polls MediaMTX's internal API to discover exactly which streams are currently live, their uptime, and their metadata.
4. **Nginx:** The traffic controller. It takes all incoming browser requests on port `80` and routes them securely:
   - `/api/*` requests go to the Node.js Backend.
   - `/hls/*` requests go directly to MediaMTX.
   - All other requests render the React frontend.
5. **React SPA:** The viewer's client. It asks the Node.js API "who is live right now?", builds the dashboard UI, and uses `hls.js` to smoothly stitch MediaMTX's video segments back together for seamless playback.

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- OBS Studio, FFmpeg, or VLC (as the streaming source)

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

**Using FFmpeg (Best for testing with local video files):**
To stream a local video file in a continuous loop:
```bash
ffmpeg -re -stream_loop -1 -i "video.mp4" -c copy -f flv rtmp://localhost:1935/live/mystream
```

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
