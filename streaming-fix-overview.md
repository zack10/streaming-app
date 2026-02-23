# StreamFlow Streaming Fix Overview

This document explains the series of issues encountered when attempting to stream to the local environment and how they were resolved.

## 1. Authentication Prompt on `:9997` (MediaMTX HTTP API)
**Problem:** When accessing `http://localhost:9997` in the browser, a username/password prompt appeared.
**Cause:** MediaMTX's default behavior allows unauthenticated access from `localhost`. However, when running inside Docker, requests coming from the host machine's browser appear as external IP requests to the container, triggering the default HTTP Basic Auth protection.
**Solution:** We added an `authInternalUsers` block in `media-server/mediamtx.yml` to explicitly allow anonymous (`user: any`) access to the `api` role.

## 2. FFmpeg Authentication Failed (`401 Unauthorized`) 
**Problem:** Streaming with FFmpeg (`ffmpeg -re -i video.mp4 ...`) failed with `authentication failed: authentication failed`.
**Cause:** Our initial anonymous auth rule only granted permission for the `api` action. It did not grant permissions to publish or read streams via RTMP.
**Solution:** Added `publish` and `read` actions to the anonymous user permissions list in `mediamtx.yml`.

## 3. Frontend Error `404 Not Found` for `index.m3u8`
**Problem:** The browser requested `http://localhost:5173/hls/live/mystream/index.m3u8` but received a 404 error, even though the `/api/streams` endpoint showed the stream existed.
**Cause:** The backend API showed a "ghost" stream (an old entry that hadn't been purged from MediaMTX's state). Additionally, the video being streamed via FFmpeg was very short and ended before MediaMTX could generate the HLS files.

## 4. MediaMTX Log Error: `Low-Latency HLS requires at least 7 segments`
**Problem:** After looping the FFmpeg stream (`-stream_loop -1`), MediaMTX logs threw an error and destroyed the muxer before generating the HLS playlist.
**Cause:** The default configuration was using Low-Latency HLS (LL-HLS), which relies on a strict pipeline. When FFmpeg loops a short video file, the timestamps abruptly reset to zero. This breaks the chronological order of the segments, causing the LL-HLS muxer to crash and demand "at least 7 normal segments" before it can start.

## 5. Invalid Configuration `ERR: invalid HLS variant: 'standard'`
**Problem:** We attempted to downgrade from LL-HLS to standard HLS using `hlsVariant: standard`, but the container crashed on restart.
**Cause:** Newer versions of the `bluenviron/mediamtx` Docker image changed the configuration syntax. `standard` is no longer a valid enum value for `hlsVariant`.
**Solution:** Updated the configuration to `hlsVariant: mpegts` (the correct default standard HLS format) and increased `hlsSegmentCount` to 7 to provide a larger buffer, which successfully allowed FFmpeg's looping video to stabilize and stream to the React frontend.
