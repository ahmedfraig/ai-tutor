import React, { useState, useEffect } from "react";
import apiClient from "../../api/apiClient";
import "./VideoPlayer.css";

const BASE_URL = (apiClient.defaults.baseURL || "").replace("/api", "");

/* ─── URL Detectors ─────────────────────────────────────────────── */

/**
 * Extract YouTube video ID from any YouTube URL format:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 */
function getYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v") || u.pathname.split("/").pop() || null;
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.replace("/", "");
    }
  } catch {}
  return null;
}

/**
 * Extract Google Drive file ID from any Drive URL format:
 *   https://drive.google.com/uc?export=view&id=FILE_ID
 *   https://drive.google.com/file/d/FILE_ID/view
 */
function getDriveFileId(url) {
  if (!url) return null;
  try {
    const p = new URL(url).searchParams.get("id");
    if (p) return p;
  } catch {}
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/* ─── Sub-components ─────────────────────────────────────────────── */

/** Loading spinner overlay shown while the iframe loads */
function LoadingOverlay() {
  return (
    <div className="vp-loading" aria-hidden="true">
      <div className="vp-spinner" />
    </div>
  );
}

/** State box for placeholder / error / generating states */
function StateBox({ variant, icon, label, sub, actions }) {
  return (
    <div className={`vp-state vp-${variant}`} role={variant === "error" ? "alert" : undefined}>
      <div className={`vp-icon-wrap${variant !== "placeholder" ? ` vp-icon-wrap--${variant}` : ""}`} aria-hidden="true">
        {icon}
      </div>
      <p className="vp-label">{label}</p>
      {sub && <p className="vp-sub">{sub}</p>}
      {actions && <div className="vp-error-actions">{actions}</div>}
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────── */
const PlayIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const SpinnerIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);
const ErrorIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

/* ─── Main Component ─────────────────────────────────────────────── */

function VideoPlayer({ title, filePath, fileId, lessonId }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  // Local override: if refresh finds the file is ready, store it here
  const [localFilePath, setLocalFilePath] = useState(filePath);
  const [isChecking, setIsChecking] = useState(false);
  const [checkMsg, setCheckMsg]     = useState("");

  // Reliable mobile detection — uses matchMedia (same engine as CSS media queries)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const label = title || "AI-Generated Video";

  // Sync local path when the parent selects a different video
  useEffect(() => {
    setLocalFilePath(filePath);
    setIframeLoaded(false);
    setIframeError(false);
    setCheckMsg("");
  }, [fileId, filePath]);

  // ── Soft refresh: re-fetch only this file record from the API ─────
  const handleRefreshCheck = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckMsg("");
    try {
      const res = await apiClient.get(`/lesson-files/${lessonId}`);
      const record = res.data.find((f) => f.id === fileId);
      if (record && record.file_path) {
        // Video is ready — update local state, no page reload needed
        setLocalFilePath(record.file_path);
      } else {
        setCheckMsg("Still processing… try again in a moment.");
      }
    } catch {
      setCheckMsg("Could not check status. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  // Use localFilePath for all URL detection so refresh works without prop change
  const activeFilePath = localFilePath;

  // ── Detect URL type ───────────────────────────────────────────────
  const youtubeId = getYouTubeId(activeFilePath);
  const driveId   = getDriveFileId(activeFilePath);

  /* ── Case 1: DB record exists but file not ready yet (AI still generating) */
  if (fileId && !activeFilePath) {
    return (
      <StateBox
        variant="generating"
        icon={<SpinnerIcon />}
        label="Generating your video…"
        sub={checkMsg || "The AI is still processing your content. Check back in a few minutes."}
        actions={
          <button
            className="vp-retry-btn vp-retry-btn--accent"
            type="button"
            onClick={handleRefreshCheck}
            disabled={isChecking}
          >
            {isChecking ? "Checking…" : "Refresh to check"}
          </button>
        }
      />
    );
  }

  /* ── Case 2: No file selected at all */
  if (!fileId && !activeFilePath) {
    return (
      <StateBox
        variant="placeholder"
        icon={<PlayIcon />}
        label={label}
        sub="Video will appear here once generated by AI"
      />
    );
  }

  /* ── Case 3: YouTube URL — embed with YouTube iframe player */
  if (youtubeId) {
    const embedUrl = `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`;
    return (
      <div className="vp-wrap">
        {!iframeLoaded && <LoadingOverlay />}
        <iframe
          key={embedUrl}
          className="vp-iframe"
          src={embedUrl}
          title={label}
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setIframeLoaded(true)}
          style={{ opacity: iframeLoaded ? 1 : 0 }}
        />
      </div>
    );
  }

  /* ── Case 4: Google Drive URL ─────────────────────────────────────
     Desktop → Drive /preview iframe (works fine at wide widths)
     Mobile  → Native <video> via our backend stream proxy
               (avoids Drive's broken iframe controls on mobile)
     ──────────────────────────────────────────────────────────────── */
  if (driveId) {
    const driveEmbedUrl = `https://drive.google.com/file/d/${driveId}/preview`;
    const driveViewUrl  = `https://drive.google.com/file/d/${driveId}/view`;
    // Our backend proxies the video through Drive API — handles auth + Range headers
    // Native <video> can't send Authorization headers, so we pass the JWT in the URL
    const authToken = localStorage.getItem('token');
    const streamUrl = (fileId && authToken)
      ? `${BASE_URL}/api/lesson-files/stream/${fileId}?token=${encodeURIComponent(authToken)}`
      : null;

    // ── Mobile: native <video> via backend stream proxy ──────────
    if (isMobile && streamUrl) {
      return (
        <div className="vp-wrap vp-wrap--native">
          <video
            key={streamUrl}
            className="vp-video"
            controls
            preload="metadata"
            playsInline
            aria-label={label}
          >
            <source src={streamUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    // ── Desktop: Drive /preview iframe (controls work fine at wide widths) ──
    return (
      <div className="vp-wrap vp-wrap--drive">
        {!iframeLoaded && !iframeError && <LoadingOverlay />}
        {iframeError ? (
          <StateBox
            variant="error"
            icon={<ErrorIcon />}
            label="Couldn't load the video"
            sub="The file may be unavailable. Try opening it directly in Google Drive."
            actions={
              <>
                <a
                  className="vp-watch-btn"
                  href={driveViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Watch on Google Drive
                </a>
                <button
                  className="vp-retry-btn"
                  type="button"
                  onClick={() => { setIframeError(false); setIframeLoaded(false); }}
                >
                  Try again
                </button>
              </>
            }
          />
        ) : (
          <div className="vp-drive-container">
            <iframe
              key={driveEmbedUrl}
              className="vp-drive-iframe"
              src={driveEmbedUrl}
              title={label}
              scrolling="no"
              allow="autoplay"
              allowFullScreen
              onLoad={() => setIframeLoaded(true)}
              onError={() => setIframeError(true)}
              style={{ opacity: iframeLoaded ? 1 : 0 }}
            />
          </div>
        )}
        {!iframeError && (
          <a
            className="vp-external-link"
            href={driveViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Drive"
            aria-label="Open video in Google Drive"
          >
            &#x2197;
          </a>
        )}
      </div>
    );
  }

  /* ── Case 5: Backend stream URL or other direct URL */
  if (fileId && activeFilePath) {
    const streamSrc = `${BASE_URL}/api/lesson-files/stream/${fileId}`;
    return (
      <div className="vp-wrap">
        <video
          key={streamSrc}
          className="vp-video"
          controls
          preload="metadata"
          aria-label={label}
        >
          <source src={streamSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  /* ── Fallback: nothing to show */
  return (
    <StateBox
      variant="placeholder"
      icon={<PlayIcon />}
      label={label}
      sub="No video available"
    />
  );
}

export default VideoPlayer;
