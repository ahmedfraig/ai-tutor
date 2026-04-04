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
  const [fileCounts, setFileCounts] = useState({ videos: 0, audios: 0, quizzes: 0 });
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!lessonId) { setLoading(false); return; }

    const fetchAll = async () => {
      try {
        // Fetch user-lesson tracking + lesson files in parallel
        const [trackingRes, filesRes, genRes] = await Promise.all([
          apiClient.get(`/user-lessons/${lessonId}`).catch(() => ({ data: null })),
          apiClient.get(`/lesson-files/${lessonId}`).catch(() => ({ data: [] })),
          apiClient.get(`/ai-generations/lesson/${lessonId}`).catch(() => ({ data: [] })),
        ]);

        setData(trackingRes.data);

        // Count files by type dynamically
        const files = filesRes.data || [];
        const videoCount = files.filter(f => f.type === 'video').length;
        const audioCount = files.filter(f => f.type === 'audio').length;

        // Count quiz/exam generations
        const gens = genRes.data || [];
        const quizCount = gens.filter(g => g.type === 'quiz').length;

        setFileCounts({
          videos: videoCount,
          audios: audioCount,
          quizzes: quizCount,
        });
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
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
  const examScore       = Number(data?.exam_score) || 0;
  const practiceOk      = !!data?.practice_completed;

  // Dynamic totals from actual lesson files
  const totalVideos     = Math.max(fileCounts.videos, 1); // min 1 to avoid /0
  const totalAudios     = Math.max(fileCounts.audios, 1);
  const totalQuizzes    = Math.max(fileCounts.quizzes, 1);

  // Weighted completion: 30% videos, 25% quiz, 25% exam, 20% practice
  const vPct = Math.min(videosWatched / totalVideos, 1) * 30;
  const qPct = (quizScore / 100) * 25;
  const ePct = (examScore / 100) * 25;
  const pPct = practiceOk ? 20 : 0;
  const rawCompletion = vPct + qPct + ePct + pPct;
  const completion = Number.isNaN(rawCompletion) ? 0 : Math.round(rawCompletion);

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

        <ProgressRow label="Videos Watched"   current={videosWatched}       total={totalVideos} />
        <ProgressRow label="Audio Lessons"    current={0}                    total={totalAudios} />
        <ProgressRow label="Practice Quizzes" current={practiceOk ? 1 : 0}  total={totalQuizzes} />
      </div>

    </div>
  );
};

export default AnalyticsSection;