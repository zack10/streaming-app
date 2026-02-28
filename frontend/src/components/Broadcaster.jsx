import { useEffect, useRef, useState } from 'react';

export default function Broadcaster() {
	const videoRef = useRef(null);
	const pcRef = useRef(null);
	const [streamKey, setStreamKey] = useState(`web_${Math.random().toString(36).substring(2, 8)}`);
	const [isBroadcasting, setIsBroadcasting] = useState(false);
	const [error, setError] = useState(null);
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		// Cleanup function when component unmounts
		return () => {
			stopBroadcast();
		};
	}, []);

	const startBroadcast = async () => {
		try {
			setError(null);

			// 1. Get user media (video and audio)
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
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
		<div className="broadcaster-container" style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
			<h2 style={{ marginBottom: '1rem' }}>🎥 Broadcast Live</h2>

			<div className="setup-field" style={{ marginBottom: '1rem' }}>
				<label>Stream Key (Your channel name)</label>
				<input
					value={streamKey}
					onChange={(e) => setStreamKey(e.target.value)}
					disabled={isBroadcasting}
					style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
				/>
				<small style={{ color: 'var(--text-muted)' }}>This is the name viewers will see.</small>
			</div>

			{error && (
				<div className="player-error" style={{ marginBottom: '1rem', padding: '0.5rem', background: '#ff444433', color: '#ffaaaa', borderRadius: '4px' }}>
					⚠️ {error}
				</div>
			)}

			<div style={{ position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden', aspectRatio: '16/9', marginBottom: '1rem' }}>
				<video
					ref={videoRef}
					autoPlay
					playsInline
					style={{ width: '100%', height: '100%', objectFit: 'cover' }}
				/>
				{isBroadcasting && (
					<div style={{ position: 'absolute', top: '10px', right: '10px' }}>
						<span className="badge-live"><span className="dot" /> {connected ? 'LIVE' : 'CONNECTING...'}</span>
					</div>
				)}
				{!isBroadcasting && videoRef.current?.srcObject && (
					<div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', color: 'white' }}>
						Preview
					</div>
				)}
			</div>

			<div style={{ display: 'flex', gap: '1rem' }}>
				{!isBroadcasting ? (
					<button
						onClick={startBroadcast}
						style={{ flex: 1, padding: '0.75rem', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
					>
						▶ Go Live
					</button>
				) : (
					<button
						onClick={stopBroadcast}
						style={{ flex: 1, padding: '0.75rem', background: '#4a5568', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
					>
						⏹ Stop Broadcasting
					</button>
				)}
			</div>
		</div>
	);
}
