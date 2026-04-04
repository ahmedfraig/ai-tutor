import React from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import './Quiz.css';

function Quiz({ lessonId, lessonTitle }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="quiz-tab-root">
      <div className="quiz-cta-card">
        <div className="quiz-cta-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 className="quiz-cta-title">Test Your Knowledge</h3>
        <p className="quiz-cta-desc">
          Take a flashcard quiz to reinforce what you've learned in this lesson.
        </p>
        <button
          className="quiz-start-btn"
          onClick={() => navigate("/flashcardquiz", {
            state: { ...(location.state || {}), lessonId, lessonTitle }
          })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Quiz
        </button>
      </div>
    </div>
  );
}

export default Quiz;
