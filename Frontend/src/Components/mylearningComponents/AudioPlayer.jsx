import React, { useState, useEffect } from "react";
import "./AudioPlayer.css";
import { BsMusicNoteBeamed } from "react-icons/bs";
import apiClient from "../../api/apiClient";

// Extract Drive file ID from stored URL formats
function getDriveFileId(url) {
  if (!url) return null;
  try {
    const idParam = new URL(url).searchParams.get("id");
    if (idParam) return idParam;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const AudioPlayer = ({ title, filePath, fileId, lessonId }) => {
  const driveId = getDriveFileId(filePath);

  // HIGH-1: short-lived stream token — keeps full JWT out of audio src URLs
  const [streamToken, setStreamToken] = useState(null);
  const [localFilePath, setLocalFilePath] = useState(filePath);
  const [isChecking, setIsChecking] = useState(false);

  // Sync when props change
  useEffect(() => {
    setLocalFilePath(filePath);
    setStreamToken(null);
  }, [fileId, filePath]);

  // Fetch stream token when we have a file with a path
  useEffect(() => {
    if (!fileId || !localFilePath) return;
    let cancelled = false;
    apiClient.post(`/lesson-files/stream-token/${fileId}`)
      .then((res) => { if (!cancelled) setStreamToken(res.data.token); })
      .catch(() => { if (!cancelled) setStreamToken(null); });
    return () => { cancelled = true; };
  }, [fileId, localFilePath]);

  // ── Auto-poll when audio is generating (fileId exists, no filePath) ──
  useEffect(() => {
    if (!fileId || localFilePath || !lessonId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/lesson-files/${lessonId}`);
        const record = data.find((f) => f.id === fileId);
        if (record && record.file_path) {
          setLocalFilePath(record.file_path);
        }
      } catch { /* ignore polling errors */ }
    }, 10000); // check every 10 seconds
    return () => clearInterval(interval);
  }, [fileId, localFilePath, lessonId]);

  // ── Manual refresh check ────────────────────────────────────
  const handleRefresh = async () => {
    if (isChecking || !lessonId) return;
    setIsChecking(true);
    try {
      const { data } = await apiClient.get(`/lesson-files/${lessonId}`);
      const record = data.find((f) => f.id === fileId);
      if (record && record.file_path) {
        setLocalFilePath(record.file_path);
      }
    } catch { /* ignore */ }
    setIsChecking(false);
  };

  const activeDriveId = getDriveFileId(localFilePath);

  // ── Generating state (fileId exists but no file yet) ───────
  if (fileId && !localFilePath) {
    return (
      <div className="audio-player-container">
        <div className="icon-wrapper">
          <BsMusicNoteBeamed className="music-icon" style={{ animation: 'spin 2s linear infinite' }} />
        </div>
        <h3 className="track-title">{title || "AI Audio Lesson"}</h3>
        <p className="track-subtitle">Generating your audio… this may take a few minutes.</p>
        <button
          onClick={handleRefresh}
          disabled={isChecking}
          style={{
            marginTop: '0.75rem',
            padding: '0.45rem 1.2rem',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          {isChecking ? 'Checking…' : '🔄 Refresh to check'}
        </button>
      </div>
    );
  }

  // ── Real audio player ──────────────────────────────────────────
  if (activeDriveId || (fileId && localFilePath)) {
    let streamSrc = null;
    if (fileId && streamToken) {
      streamSrc = `/api/lesson-files/stream/${fileId}?streamToken=${encodeURIComponent(streamToken)}`;
    } else if (activeDriveId) {
      streamSrc = `https://drive.google.com/uc?export=download&id=${activeDriveId}`;
    }

    return (
      <div className="audio-player-real">
        <div className="audio-player-real__icon">
          <BsMusicNoteBeamed size={32} />
        </div>
        <div className="audio-player-real__info">
          <p className="audio-player-real__title">{title || "AI Audio Lesson"}</p>
          <p className="audio-player-real__sub">AI Voice Lesson</p>
        </div>
        {streamSrc ? (
          <audio
            controls
            className="audio-player-real__element"
            src={streamSrc}
            preload="metadata"
          >
            Your browser does not support the audio element.
          </audio>
        ) : (
          <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Loading audio…</p>
        )}
      </div>
    );
  }


  // ── Placeholder (audio not yet generated) ─────────────────────
  const waveformBars = [20,40,30,50,40,60,30,50,40,30,20,40,50,60,70,50,40,60,50,40,30,20,40,30,50,40,60,30,50,40];

  return (
    <div className="audio-player-container">
      <div className="icon-wrapper">
        <BsMusicNoteBeamed className="music-icon" />
      </div>
      <h3 className="track-title">{title || "AI Audio Lesson"}</h3>
      <p className="track-subtitle">Audio will appear here once generated by AI</p>

      <div className="waveform waveform--inactive">
        {waveformBars.map((height, index) => (
          <div key={index} className="wave-bar" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
};

export default AudioPlayer;