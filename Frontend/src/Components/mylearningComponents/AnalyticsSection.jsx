import React, { useEffect, useState } from 'react';
import { Card, Row, Col, ProgressBar } from 'react-bootstrap';
import './AnalyticsSection.css';
import apiClient from '../../api/apiClient';

const LearningProgressBar = ({ label, current, total }) => {
  const [mounted, setMounted] = useState(false);
  const percentage = total > 0 ? (current / total) * 100 : 0;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <small className="text-dark fw-bold">{label}</small>
        <small className="text-dark fw-bold">{`${current}/${total}`}</small>
      </div>
      
      <div className="progress analytics-progress-track" style={{ height: '5px' }}>
        <div
          className="progress-bar analytics-progress-fill"
          role="progressbar"
          style={{ width: `${mounted ? percentage : 0}%`, borderRadius: '10px', backgroundColor: 'var(--color-accent, #ff6900)' }}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

const AnalyticsSection = ({ lessonId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!lessonId) {
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const res = await apiClient.get(`/user-lessons/${lessonId}`);
        setData(res.data);
      } catch (err) {
        // 404 means the user hasn't started this lesson yet — show zeros
        if (err.response?.status === 404) {
          setData(null);
        } else {
          console.error("Failed to fetch analytics:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [lessonId]);

  if (loading) return <div className="pt-3 text-muted">Loading analytics...</div>;

  // Compute display values from real data (or zero defaults)
  const timeSpentSec = Number(data?.time_spent) || 0;
  const hours = Math.floor(timeSpentSec / 3600);
  const minutes = Math.floor((timeSpentSec % 3600) / 60);
  const timeSpentLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const videosWatched = Number(data?.videos_watched_count) || 0;
  const quizScore = Number(data?.quiz_score) || 0;
  const practiceCompleted = !!data?.practice_completed;

  // completion = weighted average of progress indicators (NaN-safe)
  const rawCompletion =
    (Math.min(videosWatched, 2) / 2) * 0.4 +
    (practiceCompleted ? 1 : 0) * 0.3 +
    (quizScore / 100) * 0.3;
  const completion = Number.isNaN(rawCompletion) ? 0 : Math.round(rawCompletion * 100);

  return (
    <div className="analytics-content py-4">
      <Row className="mb-4">
        
        <Col md={4} className="mb-3">
          <Card className="shadow-sm border-0 h-100 analytics-card" style={{ borderLeft: '4px solid var(--color-accent, #ff6900)', borderRadius: '12px' }}>
            <Card.Body>
              <p className="text-muted">Completion</p>
              <h3 className="fw-normal mb-3">{completion}%</h3>
              <div className="progress analytics-progress-track" style={{ height: '3px' }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${mounted ? completion : 0}%`, borderRadius: '10px', backgroundColor: 'var(--color-accent, #ff6900)', transition: 'width 700ms cubic-bezier(0.25,1,0.5,1)' }}
                  aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4} className="mb-3">
          <Card className="shadow-sm border-0 h-100 analytics-card">
            <Card.Body>
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-patch-question" style={{ color: '#f59e0b', fontSize: '1rem' }}></i>
                <p className="text-muted mb-0">Quiz Avg</p>
              </div>
              <h3 className="fw-normal mb-3">{quizScore}%</h3>
              <div className="progress analytics-progress-track" style={{ height: '3px' }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${mounted ? quizScore : 0}%`, borderRadius: '10px', backgroundColor: 'var(--color-accent, #ff6900)', transition: 'width 700ms cubic-bezier(0.25,1,0.5,1)' }}
                  aria-valuenow={quizScore} aria-valuemin={0} aria-valuemax={100}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4} className="mb-3">
          <Card className="shadow-sm border-0 h-100 analytics-card">
            <Card.Body>
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-clock-fill" style={{ color: '#22c55e', fontSize: '1rem' }}></i>
                <p className="text-muted mb-0">Time Spent</p>
              </div>
              <h3 className="fw-normal mb-3">{timeSpentLabel}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm border-0 analytics-card">
        <Card.Body>
          <div className="d-flex align-items-center gap-2 mb-4">
            <i className="bi bi-bar-chart-fill" style={{ color: 'var(--color-accent)', fontSize: '1.1rem' }}></i>
            <h4 className="fw-bold mb-0">Learning Progress</h4>
          </div>
          
          <LearningProgressBar 
            label="Videos Watched" 
            current={videosWatched} 
            total={2} 
          />
          <LearningProgressBar
            label="Audio Lessons"
            current={0}
            total={1}
          />
          <LearningProgressBar
            label="Practice Quizzes"
            current={data?.practice_completed ? 1 : 0}
            total={3}
          />
        </Card.Body>
      </Card>
    </div>
  );
};

export default AnalyticsSection;