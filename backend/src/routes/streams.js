import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

const MEDIAMTX_API = process.env.MEDIAMTX_API || 'http://mediamtx:9997';

router.get('/', async (_req, res) => {
  try {
    const response = await fetch(`${MEDIAMTX_API}/v3/paths/list`);

    if (!response.ok) {
      throw new Error(`MediaMTX returned ${response.status}`);
    }

    const data = await response.json();

    // Filter to only paths that have an active publisher
    const streams = (data.items || [])
      .filter((path) => path.ready)
      .map((path) => ({
        name: path.name,
        // Relative URL — nginx proxies /hls/* → mediamtx:8888
        hlsUrl: `/hls/${path.name}/index.m3u8`,
        rtmpIngestUrl: `rtmp://YOUR_SERVER_IP:1935/${path.name}`,
        readyTime: path.readyTime || null,
      }));

    res.json({ streams });
  } catch (err) {
    console.error('[streams] Error fetching from MediaMTX:', err.message);
    res.status(503).json({
      error: 'Media server unavailable',
      streams: [],
    });
  }
});

export default router;
