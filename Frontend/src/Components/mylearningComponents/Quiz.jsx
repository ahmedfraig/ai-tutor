import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import './Quiz.css';
import '../mylearningComponents/ExamSection.css'; // shared pill styles

const QTY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
];

const DIFF_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "standard", label: "Standard" },
  { value: "hard", label: "Hard" },
];

function Quiz({ lessonId, lessonTitle, onGenerate, generating }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasQuiz, setHasQuiz] = useState(null); // null=loading, true/false
  const [qty, setQty] = useState("standard");
  const [diff, setDiff] = useState("standard");

  useEffect(() => {
    if (!lessonId) { setHasQuiz(false); return; }
    // Re-check whenever generation finishes (generating goes null)
    if (generating) return;
    const check = async () => {
      try {
        const res = await apiClient.get(`/ai-generations/lesson/${lessonId}?type=quiz`);
        setHasQuiz(res.data.length > 0);
      } catch {
        setHasQuiz(false);
      }
    };
    check();
  }, [lessonId, generating]);

  const handleGenerate = () => {
    if (onGenerate) onGenerate(qty, diff);
  };

  const renderPills = (label, options, value, onChange) => (
    <div className="option-group">
      <p className="option-group__label">{label}</p>
      <div className="option-pills">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`option-pill${value === opt.value ? " option-pill--active" : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

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

        {hasQuiz === null && (
          <p className="quiz-cta-desc">Checking quiz status…</p>
        )}

        {hasQuiz === false && !generating && (
          <>
            <p className="quiz-cta-desc">
              No quiz generated yet. Choose your preferences and generate one.
            </p>

            {/* Qty & Diff selectors */}
            <div className="options-row">
              {renderPills("Quantity", QTY_OPTIONS, qty, setQty)}
              {renderPills("Difficulty", DIFF_OPTIONS, diff, setDiff)}
            </div>

            {onGenerate && (
              <div className="quiz-cta-actions">
                <button
                  className="quiz-start-btn"
                  onClick={handleGenerate}
                  disabled={!!generating}
                  aria-busy={generating === 'quiz'}
                  aria-label="Generate a quiz for this lesson"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Generate Quiz
                </button>
              </div>
            )}
          </>
        )}

        {generating === 'quiz' && (
          <p className="quiz-cta-desc quiz-cta-generating">
            <span className="quiz-spinner" aria-hidden="true" /> AI is generating your quiz…
          </p>
        )}

        {hasQuiz === true && (
          <>
            <p className="quiz-cta-desc">
              Take a flashcard quiz to reinforce what you've learned in this lesson.
            </p>
            <div className="quiz-cta-actions">
              <button
                className="quiz-start-btn"
                onClick={() => navigate("/flashcardquiz", {
                  state: { ...(location.state || {}), lessonId, lessonTitle }
                })}
                aria-label={`Start quiz for ${lessonTitle || 'this lesson'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start Quiz
              </button>

              {/* Regenerate with options */}
              <div className="options-row mt-3" style={{ width: '100%' }}>
                {renderPills("Quantity", QTY_OPTIONS, qty, setQty)}
                {renderPills("Difficulty", DIFF_OPTIONS, diff, setDiff)}
              </div>

              {onGenerate && (
                <button
                  className="quiz-generate-link"
                  onClick={handleGenerate}
                  disabled={!!generating}
                  aria-busy={generating === 'quiz'}
                  aria-label="Regenerate quiz"
                >
                  <span className="regen-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                  </span>
                  Regenerate Quiz
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Quiz;
