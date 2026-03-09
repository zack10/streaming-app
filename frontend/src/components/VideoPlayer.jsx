import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

export default function VideoPlayer({ stream }) {
	const videoRef = useRef(null);
	const hlsRef = useRef(null);
	const pcRef = useRef(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const [playbackMethod, setPlaybackMethod] = useState('');

	const containerRef = useRef(null);

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
				console.log(`WebRTC Connection State: ${pc.connectionState}`);
				if (pc.connectionState === 'failed') {
					setError("WebRTC Connection Failed — check terminal/console for details");
					throw new Error("WebRTC Connection Failed");
				}
			};

			pc.oniceconnectionstatechange = () => {
				console.log(`WebRTC ICE Connection State: ${pc.iceConnectionState}`);
			};

			pc.onicegatheringstatechange = () => {
				console.log(`WebRTC ICE Gathering State: ${pc.iceGatheringState}`);
			};

			pc.onicecandidateerror = (event) => {
				console.error("WebRTC ICE Candidate Error:", event);
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

	const toggleFullscreen = () => {
		if (!containerRef.current) return;
		if (!document.fullscreenElement) {
			containerRef.current.requestFullscreen().catch(err => {
				console.error(`Error attempting to enable full-screen mode: ${err.message}`);
			});
		} else {
			document.exitFullscreen();
		}
	};

	return (
		<div className="player-wrapper" ref={containerRef}>
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
				style={{ display: loading || error ? 'none' : 'block', objectFit: 'contain' }}
			/>

			{!loading && !error && (
				<>
					{playbackMethod && (
						<div
							style={{
								position: "absolute",
								top: "16px",
								left: "16px",
								background: "rgba(0,0,0,0.6)",
								backdropFilter: "blur(4px)",
								padding: "6px 12px",
								borderRadius: "99px",
								fontSize: "11px",
								fontWeight: "700",
								color: "#fff",
								border: "1px solid rgba(255,255,255,0.1)",
								zIndex: 10
							}}
						>
							{playbackMethod}
						</div>
					)}
					<button
						onClick={toggleFullscreen}
						style={{
							position: "absolute",
							bottom: "16px",
							right: "16px",
							background: "rgba(0,0,0,0.6)",
							backdropFilter: "blur(4px)",
							padding: "8px 12px",
							borderRadius: "8px",
							fontSize: "12px",
							color: "#fff",
							border: "1px solid rgba(255,255,255,0.1)",
							cursor: "pointer",
							zIndex: 10,
							display: "flex",
							alignItems: "center",
							gap: "6px"
						}}
					>
						⛶ Fullscreen
					</button>
				</>
			)}
		</div>
	);
}
