import React, { useEffect, useState } from 'react';
import './AnalyticsSection.css';
import apiClient from '../../api/apiClient';

/* ── Sub-component: animated progress bar row ───────────────────── */
const ProgressRow = ({ label, current, total }) => {
  const [mounted, setMounted] = useState(false);
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="as-progress-row">
      <div className="as-progress-meta">
        <span className="as-progress-label">{label}</span>
        <span className="as-progress-frac">{current}/{total}</span>
      </div>
      <div className="as-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="as-fill" style={{ width: `${mounted ? pct : 0}%` }} />
      </div>
    </div>
  );
};

/* ── Sub-component: stat card ───────────────────────────────────── */
const StatCard = ({ icon, iconColor, label, value, progress, mounted }) => (
  <div className="as-stat-card">
    <div className="as-stat-header">
      {icon && <span className="as-stat-icon" style={{ color: iconColor }}>{icon}</span>}
      <span className="as-stat-label">{label}</span>
    </div>
    <div className="as-stat-value">{value}</div>
    {progress !== undefined && (
      <div className="as-track as-track--thin" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="as-fill" style={{ width: `${mounted ? progress : 0}%`, transition: 'width 700ms cubic-bezier(0.25,1,0.5,1)' }} />
      </div>
    )}
  </div>
);

/* ── Main component ─────────────────────────────────────────────── */
const AnalyticsSection = ({ lessonId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!lessonId) { setLoading(false); return; }

    const fetch_ = async () => {
      try {
        const res = await apiClient.get(`/user-lessons/${lessonId}`);
        setData(res.data);
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error('Failed to fetch analytics:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetch_();
  }, [lessonId]);

  if (loading) {
    return (
      <div className="as-loading">
        <div className="as-spinner" />
        <span>Loading analytics…</span>
      </div>
    );
  }

  const timeSpentSec    = Number(data?.time_spent) || 0;
  const hours           = Math.floor(timeSpentSec / 3600);
  const minutes         = Math.floor((timeSpentSec % 3600) / 60);
  const timeLabel       = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const videosWatched   = Number(data?.videos_watched_count) || 0;
  const quizScore       = Number(data?.quiz_score) || 0;
  const practiceOk      = !!data?.practice_completed;

  const rawCompletion   =
    (Math.min(videosWatched, 2) / 2) * 0.4 +
    (practiceOk ? 1 : 0) * 0.3 +
    (quizScore / 100) * 0.3;
  const completion      = Number.isNaN(rawCompletion) ? 0 : Math.round(rawCompletion * 100);

  return (
    <div className="as-root">

      {/* ── Stat cards row ── */}
      <div className="as-cards-row">
        <StatCard
          label="Completion"
          value={`${completion}%`}
          progress={completion}
          mounted={mounted}
        />
        <StatCard
          icon={<i className="bi bi-patch-question" />}
          iconColor="#f59e0b"
          label="Quiz Avg"
          value={`${quizScore}%`}
          progress={quizScore}
          mounted={mounted}
        />
        <StatCard
          icon={<i className="bi bi-clock-fill" />}
          iconColor="#22c55e"
          label="Time Spent"
          value={timeLabel}
        />
      </div>

      {/* ── Learning Progress card ── */}
      <div className="as-progress-card">
        <div className="as-progress-card-header">
          <i className="bi bi-bar-chart-fill" style={{ color: 'var(--color-accent, #ff6900)', fontSize: '1.1rem' }} />
          <h4 className="as-progress-title">Learning Progress</h4>
        </div>

        <ProgressRow label="Videos Watched"  current={videosWatched} total={2} />
        <ProgressRow label="Audio Lessons"   current={0}             total={1} />
        <ProgressRow label="Practice Quizzes" current={practiceOk ? 1 : 0} total={3} />
      </div>

    </div>
  );
};

export default AnalyticsSection;