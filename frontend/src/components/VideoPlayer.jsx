import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function VideoPlayer({ stream }) {
	const videoRef = useRef(null);
	const hlsRef = useRef(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || !stream?.hlsUrl) return;

		setError(null);
		setLoading(true);

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

			return () => {
				hls.destroy();
				hlsRef.current = null;
			};
		} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
			// Safari native HLS
			video.src = stream.hlsUrl;
			video.addEventListener('loadedmetadata', () => {
				setLoading(false);
				video.play().catch(() => { });
			});
		} else {
			setError('Your browser does not support HLS playback.');
			setLoading(false);
		}
	}, [stream?.hlsUrl]);

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
		</div>
	);
}
