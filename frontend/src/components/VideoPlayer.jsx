import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

export default function VideoPlayer({ stream }) {
	const videoRef = useRef(null);
	const hlsRef = useRef(null);
	const pcRef = useRef(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const [playbackMethod, setPlaybackMethod] = useState('');

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		setError(null);
		setLoading(true);
		setPlaybackMethod('');

		// Cleanup function
		const cleanup = () => {
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
			if (pcRef.current) {
				pcRef.current.close();
				pcRef.current = null;
			}
			if (video.srcObject) {
				video.srcObject = null;
			}
		};

		cleanup();

		const startWebRTC = async () => {
			if (!stream?.webrtcUrl) throw new Error("No WebRTC URL");

			setPlaybackMethod('WebRTC (Ultra-low latency)');

			const pc = new RTCPeerConnection({
				iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
			});
			pcRef.current = pc;

			pc.addTransceiver('video', { direction: 'recvonly' });
			pc.addTransceiver('audio', { direction: 'recvonly' });

			pc.ontrack = (event) => {
				if (video.srcObject !== event.streams[0]) {
					video.srcObject = event.streams[0];
					setLoading(false);
					video.play().catch(() => { });
				}
			};

			pc.onconnectionstatechange = () => {
				if (pc.connectionState === 'failed') {
					throw new Error("WebRTC Connection Failed");
				}
			};

			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			const response = await fetch(stream.webrtcUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/sdp' },
				body: offer.sdp,
			});

			if (!response.ok) throw new Error("WHEP request failed");

			const answerSdp = await response.text();
			await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
		};

		const startHLS = () => {
			if (!stream?.hlsUrl) {
				setError("No playback source available.");
				setLoading(false);
				return;
			}

			setPlaybackMethod('HLS (Standard latency)');

			if (Hls.isSupported()) {
				const hls = new Hls({
					enableWorker: true,
					lowLatencyMode: true,
					liveSyncDurationCount: 2,
					liveMaxLatencyDurationCount: 4,
				});

				hlsRef.current = hls;
				hls.loadSource(stream.hlsUrl);
				hls.attachMedia(video);

				hls.on(Hls.Events.MANIFEST_PARSED, () => {
					setLoading(false);
					video.play().catch(() => { });
				});

				hls.on(Hls.Events.ERROR, (_event, data) => {
					if (data.fatal) {
						setError('Stream error — the source may have disconnected.');
						setLoading(false);
					}
				});
			} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
				// Safari native HLS
				video.src = stream.hlsUrl;
				video.addEventListener('loadedmetadata', () => {
					setLoading(false);
					video.play().catch(() => { });
				});
			} else {
				setError('Your browser does not support playback.');
				setLoading(false);
			}
		};

		// Try WebRTC first, fallback to HLS
		if (stream?.webrtcUrl) {
			startWebRTC().catch(err => {
				console.warn("WebRTC failed, falling back to HLS", err);
				cleanup();
				startHLS();
			});
		} else {
			startHLS();
		}

		return cleanup;
	}, [stream]);

	return (
		<div className="player-wrapper">
			{loading && !error && (
				<div className="player-error">
					<div className="loading-dots">
						<span /><span /><span />
					</div>
					<p>Connecting to stream…</p>
				</div>
			)}

			{error && (
				<div className="player-error">
					<div className="error-icon">⚠️</div>
					<p>{error}</p>
				</div>
			)}

			<video
				ref={videoRef}
				controls
				playsInline
				muted
				style={{ display: loading || error ? 'none' : 'block' }}
			/>

			{!loading && !error && playbackMethod && (
				<div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#fff' }}>
					{playbackMethod}
				</div>
			)}
		</div>
	);
}
