import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import "./Home.css";
import apiClient from "../api/apiClient";

const Home = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const username = user.full_name || "User";

  const [stats, setStats] = useState({ studyTime: "0m", lessons: 0, streak: 0 });
  const [lastLesson, setLastLesson] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch real stats + lesson data in parallel
        const [statsRes, lessonsRes] = await Promise.all([
          apiClient.get('/study-days/stats'),
          apiClient.get('/user-lessons'),
        ]);

        const { studyTimeSeconds, lessonCount, streak } = statsRes.data;

        // Format study time
        const hours = Math.floor(studyTimeSeconds / 3600);
        const minutes = Math.floor((studyTimeSeconds % 3600) / 60);
        const studyTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        // Find the most recently accessed lesson
        const records = lessonsRes.data;
        const sorted = [...records].sort((a, b) =>
          new Date(b.last_entered || 0) - new Date(a.last_entered || 0)
        );
        const recent = sorted[0] || null;

        setStats({ studyTime: studyTime || '0m', lessons: lessonCount, streak });
        setLastLesson(recent);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  // ── Calculate dynamic progress ──
  const getProgressPercent = () => {
    if (!lastLesson) return 0;
    const videosWatched = Number(lastLesson.videos_watched_count) || 0;
    const quizScore = Number(lastLesson.quiz_score) || 0;
    const examScore = Number(lastLesson.exam_score) || 0;
    const practiceOk = !!lastLesson.practice_completed;

    // Weighted: 30% videos, 25% quiz, 25% exam, 20% practice
    const vPct = Math.min(videosWatched / 2, 1) * 30;
    const qPct = (quizScore / 100) * 25;
    const ePct = (examScore / 100) * 25;
    const pPct = practiceOk ? 20 : 0;

    return Math.round(vPct + qPct + ePct + pPct);
  };

  const progress = getProgressPercent();
  const progressLabel = progress >= 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started";

  const handleContinue = () => {
    if (lastLesson) {
      navigate("/lesson", {
        state: {
          lessonId: lastLesson.lesson_id,
          lessonTitle: lastLesson.lesson_title,
        },
      });
    } else {
      navigate("/mylearning");
    }
  };

  return (
    <>
      <Header />

      <main className="container pt-4 pb-5" style={{ maxWidth: '1000px' }}>
        <header className="mb-5">
          <h2 className="mb-2 page-heading" style={{ fontWeight: '400' }}>Welcome back, {username}</h2>
          <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>Ready to continue your learning journey</p>

          <div className="card shadow-sm border-0 rounded-4" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #f9fafb 100%)' }}>
            <div className="card-body p-4 p-md-5">
              <div className="d-flex flex-column flex-md-row align-items-md-center gap-4">
                
                <div className="d-flex align-items-start gap-4 flex-grow-1">
                  <i className="bi bi-lightning-charge-fill text-warning fs-1 mt-1"></i>
                  <div className="w-100">
                    <h4 className="mb-1" style={{ fontWeight: '400' }}>{lastLesson ? "Continue Learning" : "Start Learning"}</h4>
                    <p className="text-muted mb-4" style={{ fontSize: '1.05rem' }}>{lastLesson ? lastLesson.lesson_title : "Open My Learning to begin"}</p>
                    
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted">Progress</span>
                      <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{progress}%</span>
                    </div>
                    
                    <div className="progress mb-3" style={{ height: '10px', borderRadius: '5px', backgroundColor: 'rgba(128,128,128,0.2)' }}>
                      <div className="progress-bar rounded" style={{ width: `${progress}%`, backgroundColor: 'var(--color-accent, #ff6900)' }}></div>
                    </div>
                    
                    <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                      {lastLesson ? `${Math.floor((lastLesson.time_spent || 0) / 60)} min spent` : "No sessions yet"}
                    </p>
                  </div>
                </div>

                <div className="d-flex justify-content-start justify-content-md-end align-items-center mt-3 mt-md-0 ms-md-4">
                  <button
                    className="btn btn-accent rounded-3 px-4 py-3 d-flex align-items-center hover-scale"
                    style={{ transition: 'transform 0.2s', whiteSpace: 'nowrap', fontSize: '1.1rem' }}
                    onClick={handleContinue}
                  >
                    <i className="bi bi-caret-right fs-5 me-2" style={{ color: 'white' }}></i> Continue
                  </button>
                </div>
                
              </div>
            </div>
          </div>
        </header>

        <section>
          <p className="text-muted small fw-semibold text-uppercase mb-3"
             style={{ letterSpacing: '0.08em', fontSize: '0.75rem', color: 'var(--color-accent)' }}>
            This Week
          </p>
          <div className="stats-grid">

            {/* Primary metric — Study Time */}
            <div className="card shadow-sm border-0 rounded-4 stats-card-primary">
              <div className="card-body p-4 d-flex align-items-center gap-4">
                <i className="bi bi-clock-fill fs-3" style={{ color: '#f59e0b' }}></i>
                <div>
                  <div className="text-muted small mb-1">Study Time</div>
                  <div className="fw-bold" style={{ fontSize: '1.75rem', lineHeight: 1.1 }}>
                    {loadingStats ? '—' : stats.studyTime}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>this week</div>
                </div>
              </div>
            </div>

            {/* Lessons */}
            <div className="card shadow-sm border-0 rounded-4">
              <div className="card-body p-4 d-flex flex-column justify-content-between" style={{ minHeight: '100px' }}>
                <i className="bi bi-book-fill" style={{ color: '#22c55e', fontSize: '1.25rem' }}></i>
                <div className="mt-3">
                  <div className="fw-bold" style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                    {loadingStats ? '—' : stats.lessons}
                  </div>
                  <div className="text-muted small mt-1">Lessons</div>
                </div>
              </div>
            </div>

            {/* Streak */}
            <div className="card shadow-sm border-0 rounded-4">
              <div className="card-body p-4 d-flex flex-column justify-content-between" style={{ minHeight: '100px' }}>
                <i className="bi bi-lightning-charge-fill" style={{ color: 'var(--color-accent)', fontSize: '1.25rem' }}></i>
                <div className="mt-3">
                  <div className="fw-bold" style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                    {loadingStats ? '—' : `${stats.streak}`}
                  </div>
                  <div className="text-muted small mt-1">Day streak</div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>
    </>
  );
};

export default Home;
