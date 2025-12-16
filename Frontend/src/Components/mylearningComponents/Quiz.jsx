import React from "react";
import { useNavigate } from 'react-router-dom';

import Button from 'react-bootstrap/Button';
import './Quiz.css'

function Quiz() {
  const navigate=useNavigate();
  return (
    
    <div>
    <Button variant="secondary" className="quizbtn" onClick={()=>navigate("/flashcardquiz")}>Start Quiz </Button>
    </div>
  );
}

export default Quiz;
