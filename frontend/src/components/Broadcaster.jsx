import { useEffect, useRef, useState } from 'react';

export default function Broadcaster() {
	const videoRef = useRef(null);
	const pcRef = useRef(null);
	const [streamKey, setStreamKey] = useState(`web_${Math.random().toString(36).substring(2, 8)}`);
	const [isBroadcasting, setIsBroadcasting] = useState(false);
	const [error, setError] = useState(null);
	const [connected, setConnected] = useState(false);

	const containerRef = useRef(null);
	const [previewMode, setPreviewMode] = useState('cover'); // 'cover' or 'contain'

	useEffect(() => {
		// Cleanup function when component unmounts
		return () => {
			stopBroadcast();
		};
	}, []);

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

	const startBroadcast = async () => {
		try {
			setError(null);

			// 1. Get user media (video and audio)
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1920 },
					height: { ideal: 1080 },
					frameRate: { ideal: 30 }
				},
				audio: true,
			});

			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				videoRef.current.muted = true; // Mute local preview to avoid feedback loop
			}

			// 2. Create RTCPeerConnection
			const pc = new RTCPeerConnection({
				iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], // Fallback STUN
			});
			pcRef.current = pc;

			pc.onconnectionstatechange = () => {
				console.log('WebRTC Connection State:', pc.connectionState);
				if (pc.connectionState === 'connected') {
					setConnected(true);
				} else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
					setConnected(false);
					setIsBroadcasting(false);
					if (pc.connectionState === 'failed') {
						setError('Connection failed. This is often an ICE/STUN issue.');
					}
				}
			};

			pc.onicegatheringstatechange = () => {
				console.log('ICE Gathering State:', pc.iceGatheringState);
			};

			pc.onsignalingstatechange = () => {
				console.log('Signaling State:', pc.signalingState);
			};

			pc.onicecandidate = (event) => {
				if (event.candidate) {
					console.log('New ICE Candidate:', event.candidate.candidate);
				} else {
					console.log('ICE Gathering Complete');
				}
			};

			// 3. Add tracks from user media to peer connection
			stream.getTracks().forEach((track) => pc.addTrack(track, stream));

			// 4. Create WebRTC offer
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			// 5. Send WHEP (WHIP) POST request to MediaMTX
			// We use the Nginx route /webrtc/${streamKey}/whip
			const whipUrl = `/webrtc/${streamKey}/whip`;
			const response = await fetch(whipUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/sdp',
				},
				body: offer.sdp,
			});

			if (!response.ok) {
				throw new Error(`Failed to publish stream: HTTP ${response.status}`);
			}

			// 6. Receive answer and set remote description
			const answerSdp = await response.text();
			console.log('Received Answer SDP:', answerSdp);
			await pc.setRemoteDescription({
				type: 'answer',
				sdp: answerSdp,
			});

			setIsBroadcasting(true);

		} catch (err) {
			console.error('Broadcast error:', err);
			setError(err.message || 'Failed to start broadcast');
			stopBroadcast();
		}
	};

	const stopBroadcast = () => {
		if (pcRef.current) {
			pcRef.current.close();
			pcRef.current = null;
		}

		if (videoRef.current && videoRef.current.srcObject) {
			const tracks = videoRef.current.srcObject.getTracks();
			tracks.forEach(track => track.stop());
			videoRef.current.srcObject = null;
		}

		setIsBroadcasting(false);
		setConnected(false);
	};

	return (
		<div className="broadcaster-container" style={{ padding: '2rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--glow-purple)' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
				<h2 style={{ fontSize: '24px', fontWeight: '800', background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>🎥 Go Live</h2>
				<div style={{ display: 'flex', gap: '0.5rem' }}>
					<button
						onClick={() => setPreviewMode(previewMode === 'cover' ? 'contain' : 'cover')}
						style={{ padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', transition: 'var(--transition)' }}
					>
						{previewMode === 'cover' ? 'Crop: Fill' : 'Crop: Fit'}
					</button>
					<button
						onClick={toggleFullscreen}
						style={{ padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
					>
						⛶ Fullscreen
					</button>
				</div>
			</div>

			<div className="setup-field" style={{ marginBottom: '1.5rem' }}>
				<label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stream Key (Your channel name)</label>
				<div className="input-group" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 4px 4px 12px' }}>
					<input
						value={streamKey}
						onChange={(e) => setStreamKey(e.target.value)}
						disabled={isBroadcasting}
						placeholder="e.g. gaming_session"
						style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '14px', outline: 'none', padding: '8px 0' }}
					/>
				</div>
				<small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px', fontSize: '11px' }}>This is the unique name viewers will use to find your stream.</small>
			</div>

			{error && (
				<div className="player-error" style={{ marginBottom: '1.5rem', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--red)', borderRadius: 'var(--radius-sm)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
					<span>⚠️</span> {error}
				</div>
			)}

			<div
				ref={containerRef}
				style={{ position: 'relative', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '16/9', marginBottom: '2rem', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
			>
				<video
					ref={videoRef}
					autoPlay
					playsInline
					style={{ width: '100%', height: '100%', objectFit: previewMode }}
				/>

				{/* Overlays */}
				<div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
					{isBroadcasting && (
						<span className="badge-live" style={{ background: connected ? 'var(--red)' : 'var(--text-muted)', boxShadow: connected ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none' }}>
							<span className="dot" /> {connected ? 'LIVE' : 'CONNECTING...'}
						</span>
					)}
					{!isBroadcasting && videoRef.current?.srcObject && (
						<span style={{ background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '700', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
							PREVIEW
						</span>
					)}
				</div>
			</div>

			<div style={{ display: 'flex', gap: '1rem' }}>
				{!isBroadcasting ? (
					<button
						onClick={startBroadcast}
						className="watch-btn"
						style={{ flex: 1, padding: '14px', fontSize: '16px', background: 'var(--gradient-brand)', boxShadow: 'var(--glow-purple)' }}
					>
						▶ Go Live Now
					</button>
				) : (
					<button
						onClick={stopBroadcast}
						className="close-btn"
						style={{ flex: 1, padding: '14px', fontSize: '16px', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
					>
						⏹ Stop Broadcasting
					</button>
				)}
			</div>
		</div>
	);
}
