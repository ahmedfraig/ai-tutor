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

      <header className="homeheader">
        <h2>Welcome back, {username}</h2>
        <p className="homeheaderp">Ready to continue your learning journey</p>

        <div className="homeheaderouterdiv">
          <i className="bi bi-lightning-charge-fill icond"></i>
          <div className="indiv1">
            <p className="indiv1p1">{lastLesson ? "Continue Learning" : "Start Learning"}</p>
            <p className="indiv1p2">{lastLesson ? lastLesson.lesson_title : "Open My Learning to begin"}</p>
            <div className="hdiv2">
              <label htmlFor="" className="hlabel">Progress</label>
              <label htmlFor="" className="label2">
                {lastLesson ? (lastLesson.practice_completed ? "100%" : "In Progress") : "0%"}
              </label>
              <div
                className="progress"
                role="progressbar"
                aria-label="Basic example"
                aria-valuenow="25"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div className="progress-bar bar"></div>
              </div>
              <p className="labelp">
                {lastLesson ? `${Math.floor((lastLesson.time_spent || 0) / 60)} min spent` : "No sessions yet"}
              </p>
            </div>
          </div>

          <button className="homebtn">
            <i className="bi bi-caret-right"></i>Continue
          </button>
        </div>
      </header>

      <h5 className="h5">This Week</h5>
      <main className="mainn">
        <div className="thisweekdiv">
          <div className="weekdiv2">
            <p><i className="bi bi-clock c"></i> Study Time</p>
            <p className="weekp fw-bold">
              {loadingStats ? "..." : stats.studyTime}
            </p>
          </div>
        </div>

        <div className="thisweekdiv">
          <div className="weekdiv2">
            <p><i className="bi bi-skip-end-circle"></i> Sessions</p>
            <p className="weekp fw-bold">
              {loadingStats ? "..." : stats.sessions}
            </p>
          </div>
        </div>

        <div className="thisweekdiv">
          <div className="weekdiv2">
            <p><i className="bi bi-lightning-charge"></i> Streak</p>
            <p className="weekp fw-bold">
              {loadingStats ? "..." : `${stats.streak} days`}
            </p>
          </div>
        </div>
      </main>
    </>
  );
};

export default Home;
