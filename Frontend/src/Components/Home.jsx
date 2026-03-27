import React, { useState, useEffect } from "react";
import Header from "./Header";
import "./Home.css";
import apiClient from "../api/apiClient";

const Home = () => {
  // Read user from localStorage (saved at login)
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const username = user.full_name || "User";

  const [stats, setStats] = useState({ studyTime: "0m", sessions: 0, streak: 0 });
  const [lastLesson, setLastLesson] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiClient.get('/user-lessons');
        const records = res.data;

        // Compute stats from user-lesson tracking records
        const totalSeconds = records.reduce((sum, r) => sum + (r.time_spent || 0), 0);
        const sessions = records.length;

        // Format study time
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const studyTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        // Find the most recently accessed lesson
        const sorted = [...records].sort((a, b) =>
          new Date(b.last_entered || 0) - new Date(a.last_entered || 0)
        );
        const recent = sorted[0] || null;

        setStats({ studyTime: studyTime || '0m', sessions, streak: sessions });
        setLastLesson(recent);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

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
                      <span className="text-muted">{lastLesson ? (lastLesson.practice_completed ? "100%" : "In Progress") : "0%"}</span>
                    </div>
                    
                    <div className="progress mb-3" style={{ height: '10px', borderRadius: '5px', backgroundColor: 'rgba(128,128,128,0.2)' }}>
                      <div className="progress-bar rounded" style={{ width: lastLesson ? (lastLesson.practice_completed ? '100%' : '50%') : '0%', backgroundColor: 'var(--color-accent, #ff6900)' }}></div>
                    </div>
                    
                    <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                      {lastLesson ? `${Math.floor((lastLesson.time_spent || 0) / 60)} min spent` : "No sessions yet"}
                    </p>
                  </div>
                </div>

                <div className="d-flex justify-content-start justify-content-md-end align-items-center mt-3 mt-md-0 ms-md-4">
                  <button className="btn btn-accent rounded-3 px-4 py-3 d-flex align-items-center hover-scale" style={{ transition: 'transform 0.2s', whiteSpace: 'nowrap', fontSize: '1.1rem' }}>
                    <i className="bi bi-caret-right fs-5 me-2"></i> Continue
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

            {/* Sessions */}
            <div className="card shadow-sm border-0 rounded-4">
              <div className="card-body p-4 d-flex flex-column justify-content-between" style={{ minHeight: '100px' }}>
                <i className="bi bi-play-circle-fill" style={{ color: '#22c55e', fontSize: '1.25rem' }}></i>
                <div className="mt-3">
                  <div className="fw-bold" style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                    {loadingStats ? '—' : stats.sessions}
                  </div>
                  <div className="text-muted small mt-1">Sessions</div>
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
