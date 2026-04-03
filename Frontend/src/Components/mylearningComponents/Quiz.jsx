import React from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import './Quiz.css'

function Quiz({ lessonId, lessonTitle }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '120px' }}>
      <Button
        variant="secondary"
        className="quizbtn"
        onClick={() => navigate("/flashcardquiz", {
          // Pass lessonId and any existing location state forward
          state: { ...(location.state || {}), lessonId, lessonTitle }
        })}
      >
        Start Quiz
      </Button>
    </div>
  );
}

export default Quiz;
