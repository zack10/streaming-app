import { useEffect, useState, useCallback } from 'react';
import VideoPlayer from './components/VideoPlayer.jsx';

const POLL_INTERVAL = 5000; // refresh stream list every 5 seconds

function formatDuration(readyTime) {
	if (!readyTime) return 'Just started';
	const seconds = Math.floor((Date.now() - new Date(readyTime).getTime()) / 1000);
	if (seconds < 60) return `${seconds}s live`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m live`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m live`;
}

export default function App() {
	const [streams, setStreams] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeStream, setActiveStream] = useState(null);
	const [showSetupModal, setShowSetupModal] = useState(false);

	const fetchStreams = useCallback(async () => {
		try {
			const res = await fetch('/api/streams');
			const data = await res.json();
			setStreams(data.streams || []);

			// If currently watching a stream that went offline, clear it
			if (activeStream) {
				const stillLive = (data.streams || []).some(s => s.name === activeStream.name);
				if (!stillLive) setActiveStream(null);
			}
		} catch {
			// Silently keep last known state on network error
		} finally {
			setLoading(false);
		}
	}, [activeStream]);

	useEffect(() => {
		fetchStreams();
		const interval = setInterval(fetchStreams, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [fetchStreams]);

	return (
		<div className="app">
			{/* ── Header ── */}
			<header className="header">
				<div className="logo">
					<div className="logo-icon">▶</div>
					<span className="logo-text">StreamFlow</span>
				</div>
				<div className="header-meta">
					<button className="setup-header-btn" onClick={() => setShowSetupModal(true)}>
						⚙️ Stream Setup
					</button>
					<div className="stream-count">
						<strong>{streams.length}</strong> stream{streams.length !== 1 ? 's' : ''} live
					</div>
				</div>
			</header>

			{/* ── Active Player ── */}
			{activeStream && (
				<section className="player-section">
					<div className="player-header">
						<div className="player-title-row">
							<span className="badge-live"><span className="dot" /> LIVE</span>
							<h2 className="player-title">{activeStream.name}</h2>
						</div>
						<button className="close-btn" onClick={() => setActiveStream(null)}>
							✕ Close
						</button>
					</div>

					<VideoPlayer stream={activeStream} />

					<div className="player-info-bar">
						<span className="ingest-info">
							🎙️ RTMP URL: <code>rtmp://YOUR_SERVER_IP:1935/{activeStream.name}</code>
						</span>
						<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
							{formatDuration(activeStream.readyTime)}
						</span>
					</div>
				</section>
			)}

			{/* ── Stream Grid ── */}
			{loading ? (
				<div className="loading">
					<div className="loading-dots"><span /><span /><span /></div>
					Connecting to media server…
				</div>
			) : streams.length === 0 ? (
				<EmptyState />
			) : (
				<>
					<h2 className="section-title">
						<span className="badge-live"><span className="dot" />LIVE</span>
						Active Streams
					</h2>
					<div className="stream-grid">
						{streams.map(stream => (
							<StreamCard
								key={stream.name}
								stream={stream}
								isActive={activeStream?.name === stream.name}
								onSelect={setActiveStream}
							/>
						))}
					</div>
				</>
			)}

			{/* ── Setup Modal ── */}
			{showSetupModal && (
				<StreamSetupModal onClose={() => setShowSetupModal(false)} />
			)}
		</div>
	);
}

function StreamCard({ stream, isActive, onSelect }) {
	return (
		<div
			className={`stream-card ${isActive ? 'active' : ''}`}
			onClick={() => onSelect(stream)}
		>
			<div className="card-thumb">
				<div className="thumb-icon">📡</div>
				<div className="card-live-badge">
					<span className="badge-live"><span className="dot" /> LIVE</span>
				</div>
			</div>
			<div className="card-body">
				<div className="card-name">
					{stream.name}
				</div>
				<div className="card-meta">
					<span>⏱ {formatDuration(stream.readyTime)}</span>
					<span>📶 HLS</span>
				</div>
				<button className="watch-btn">
					{isActive ? '▶ Now Playing' : '▶ Watch Live'}
				</button>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="empty-state">
			<div className="empty-icon">📡</div>
			<h2 className="empty-title">No streams live right now</h2>
			<p className="empty-subtitle">
				Start streaming from OBS Studio or VLC using RTMP and your stream will appear here automatically.
			</p>
			<div className="how-to-stream">
				<h3>📋 How to go live</h3>
				<ol>
					<li>Open OBS Studio (or VLC → Media → Stream)</li>
					<li>
						Set RTMP server to <code>rtmp://YOUR_SERVER_IP:1935/live</code>
					</li>
					<li>Set stream key to any name, e.g. <code>mystream</code></li>
					<li>Click <strong>Start Streaming</strong> — you'll appear here within seconds</li>
				</ol>
			</div>
		</div>
	);
}

function StreamSetupModal({ onClose }) {
	const [streamKey, setStreamKey] = useState('mystream');
	const [copiedKey, setCopiedKey] = useState(false);
	const [copiedUrl, setCopiedUrl] = useState(false);

	const rtmpUrl = `rtmp://localhost:1935/live`;

	const generateKey = () => {
		const randomStr = Math.random().toString(36).substring(2, 10);
		setStreamKey(`user_${randomStr}`);
		setCopiedKey(false);
	};

	const handleCopy = (text, type) => {
		navigator.clipboard.writeText(text);
		if (type === 'url') {
			setCopiedUrl(true);
			setTimeout(() => setCopiedUrl(false), 2000);
		} else {
			setCopiedKey(true);
			setTimeout(() => setCopiedKey(false), 2000);
		}
	};

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={e => e.stopPropagation()}>
				<div className="modal-header">
					<h3 className="modal-title">⚙️ OBS Studio Setup</h3>
					<button className="modal-close" onClick={onClose}>✕</button>
				</div>

				<div className="setup-field">
					<label>1. RTMP Server URL</label>
					<div className="input-group">
						<input readOnly value={rtmpUrl} />
						<button
							className={`copy-btn ${copiedUrl ? 'copied' : ''}`}
							onClick={() => handleCopy(rtmpUrl, 'url')}
						>
							{copiedUrl ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>

				<div className="setup-field">
					<label>2. Stream Key</label>
					<div className="input-group">
						<input readOnly value={streamKey} />
						<button
							className={`copy-btn ${copiedKey ? 'copied' : ''}`}
							onClick={() => handleCopy(streamKey, 'key')}
						>
							{copiedKey ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<button className="generate-btn" onClick={generateKey}>
						↻ Generate New Key
					</button>
				</div>
			</div>
		</div>
	);
}
