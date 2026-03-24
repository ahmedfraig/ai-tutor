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
          <h2 className="mb-2" style={{ fontWeight: '400', color: '#1a1a1a' }}>Welcome back, {username}</h2>
          <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>Ready to continue your learning journey</p>

          <div className="card shadow-sm border-0 rounded-4" style={{ backgroundColor: '#f4f4f5' }}>
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
                    
                    <div className="progress mb-3 bg-white" style={{ height: '10px', borderRadius: '5px' }}>
                      <div className="progress-bar bg-dark rounded" style={{ width: lastLesson ? (lastLesson.practice_completed ? '100%' : '50%') : '0%' }}></div>
                    </div>
                    
                    <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                      {lastLesson ? `${Math.floor((lastLesson.time_spent || 0) / 60)} min spent` : "No sessions yet"}
                    </p>
                  </div>
                </div>

                <div className="d-flex justify-content-start justify-content-md-end align-items-center mt-3 mt-md-0 ms-md-4">
                  <button className="btn btn-dark rounded-3 px-4 py-3 d-flex align-items-center hover-scale" style={{ transition: 'transform 0.2s', whiteSpace: 'nowrap', fontSize: '1.1rem' }}>
                    <i className="bi bi-caret-right fs-5 me-2"></i> Continue
                  </button>
                </div>
                
              </div>
            </div>
          </div>
        </header>

        <section>
          <h4 className="mb-4" style={{ fontWeight: '400' }}>This Week</h4>
          <div className="row g-4">
            
            <div className="col-12 col-md-4">
              <div className="card shadow-sm border-light rounded-4 h-100">
                <div className="card-body p-4 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <i className="bi bi-clock fs-5"></i>
                    <span style={{ fontSize: '1.1rem' }}>Study Time</span>
                  </div>
                  <span className="fw-bold" style={{ fontSize: '1.2rem' }}>{loadingStats ? "..." : stats.studyTime}</span>
                </div>
              </div>
            </div>
            
            <div className="col-12 col-md-4">
              <div className="card shadow-sm border-light rounded-4 h-100">
                <div className="card-body p-4 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <i className="bi bi-play-circle fs-5"></i>
                    <span style={{ fontSize: '1.1rem' }}>Sessions</span>
                  </div>
                  <span className="fw-bold" style={{ fontSize: '1.2rem' }}>{loadingStats ? "..." : stats.sessions}</span>
                </div>
              </div>
            </div>
            
            <div className="col-12 col-md-4">
              <div className="card shadow-sm border-light rounded-4 h-100">
                <div className="card-body p-4 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <i className="bi bi-lightning-charge fs-5"></i>
                    <span style={{ fontSize: '1.1rem' }}>Streak</span>
                  </div>
                  <span className="fw-bold" style={{ fontSize: '1.2rem' }}>{loadingStats ? "..." : `${stats.streak} days`}</span>
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
