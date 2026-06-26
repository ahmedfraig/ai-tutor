import React, { useState, useEffect, useRef, useCallback } from "react";
import "./AudioPlayer.css";
import { BsMusicNoteBeamed } from "react-icons/bs";
import apiClient from "../../api/apiClient";

/**
 * Hybrid AudioPlayer — production-ready approach:
 *
 * 1. On mount, calls /audio/prepare to get a fresh pre-signed S3 URL.
 * 2. If "processing", polls every 5s until "ready".
 * 3. If "ready", plays immediately (backend stores s3_key for future lookups).
 * 4. If "unavailable" (pipeline down but audio exists), shows a retry message.
 * 5. On subsequent page visits, /audio/prepare returns cached URL instantly.
 */
const AudioPlayer = ({ title, fileId, lessonId }) => {
  // idle | preparing | ready | unavailable | error
  const [status, setStatus] = useState("idle");
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  // ── Call /audio/prepare and return parsed result ──────────────
  const callPrepare = useCallback(async () => {
    if (!lessonId) return { status: "error" };
    try {
      const { data } = await apiClient.post("/ai-generations/audio/prepare", {
        lesson_id: lessonId,
        language: "ar",
      });
      return data; // { status, audio_url?, message?, has_audio? }
    } catch (err) {
      console.error("[AudioPlayer] prepare failed:", err.message);
      return { status: "error", message: err.response?.data?.message || err.message };
    }
  }, [lessonId]);

  // ── Main load function — polls if needed ──────────────────────
  const loadAudio = useCallback(async () => {
    if (!lessonId || !fileId) return;
    setStatus("preparing");
    setError("");
    setAudioUrl(null);

    // Poll up to 120 times (10 minutes at 5s intervals)
    for (let i = 0; i < 120; i++) {
      if (!mountedRef.current) return;

      const result = await callPrepare();

      if (result.status === "ready" && result.audio_url) {
        if (mountedRef.current) {
          setAudioUrl(result.audio_url);
          setStatus("ready");
        }
        return;
      }

      if (result.status === "unavailable") {
        // Audio exists on S3 but pipeline is temporarily down
        if (mountedRef.current) {
          setStatus("unavailable");
          setError(result.message || "Audio streaming is temporarily unavailable.");
        }
        return;
      }

      if (result.status === "error") {
        // Pipeline failed and audio was never generated
        if (mountedRef.current) {
          setStatus("error");
          setError(result.message || "Failed to prepare audio.");
        }
        return;
      }

      // status === "processing" — wait and try again
      await new Promise((resolve) => {
        pollRef.current = setTimeout(resolve, 5000);
      });
    }

    // Exhausted retries
    if (mountedRef.current) {
      setStatus("error");
      setError("Audio is still processing. Please try again later.");
    }
  }, [lessonId, fileId, callPrepare]);

  // ── Start loading when component mounts with a fileId ────────
  useEffect(() => {
    mountedRef.current = true;

    if (fileId && lessonId) {
      loadAudio();
    }

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fileId, lessonId, loadAudio]);

  // ── Preparing / polling state ──────────────────────────────────
  if (status === "preparing") {
    return (
      <div className="audio-player-container">
        <div className="icon-wrapper">
          <BsMusicNoteBeamed className="music-icon" style={{ animation: 'spin 2s linear infinite' }} />
        </div>
        <h3 className="track-title">{title || "AI Audio Lesson"}</h3>
        <p className="track-subtitle">Preparing your audio… this may take a few minutes.</p>
      </div>
    );
  }

  // ── Unavailable state (audio exists but pipeline is down) ──────
  if (status === "unavailable") {
    return (
      <div className="audio-player-container">
        <div className="icon-wrapper">
          <BsMusicNoteBeamed className="music-icon" />
        </div>
        <h3 className="track-title">{title || "AI Audio Lesson"}</h3>
        <p className="track-subtitle">{error}</p>
        <button
          onClick={loadAudio}
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
          🔄 Try Again
        </button>
      </div>
    );
  }

  // ── Error state (audio never generated, pipeline failed) ───────
  if (status === "error") {
    return (
      <div className="audio-player-container">
        <div className="icon-wrapper">
          <BsMusicNoteBeamed className="music-icon" />
        </div>
        <h3 className="track-title">{title || "AI Audio Lesson"}</h3>
        <p className="track-subtitle">{error}</p>
        <button
          onClick={loadAudio}
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
          🔄 Try Again
        </button>
      </div>
    );
  }

  // ── Ready — play audio from fresh pre-signed S3 URL ────────────
  if (status === "ready" && audioUrl) {
    return (
      <div className="audio-player-real">
        <div className="audio-player-real__icon">
          <BsMusicNoteBeamed size={32} />
        </div>
        <div className="audio-player-real__info">
          <p className="audio-player-real__title">{title || "AI Audio Lesson"}</p>
          <p className="audio-player-real__sub">AI Voice Lesson</p>
        </div>
        <audio
          key={audioUrl}
          controls
          className="audio-player-real__element"
          src={audioUrl}
          preload="metadata"
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  // ── Idle placeholder (no audio record yet) ─────────────────────
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