import React, { useState, useEffect } from 'react'
import Button from 'react-bootstrap/Button';
import { easeInOut, motion } from "framer-motion";
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../api/apiClient';

const QuizFlashcards = () => {
  const MotionDiv = motion.div;
  const navigate = useNavigate();
  const location = useLocation();
  const lessonId = location.state?.lessonId || null;

  const [showanswers, setshowanswers] = useState(0);
  const [questionnumber, setquestionnumber] = useState(0);
  const [quiz, setquiz] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);

  useEffect(() => {
    const fetchdata = async () => {
      setLoading(true);
      setError(null);
      try {
        if (lessonId) {
          const res = await apiClient.get(`/ai-generations/lesson/${lessonId}?type=quiz`);
          if (res.data.length > 0) {
            const flashcards = JSON.parse(res.data[0].content);
            setquiz(Array.isArray(flashcards) ? flashcards : []);
          } else {
            setError("No quiz has been generated for this lesson yet.");
          }
        } else {
          setError("No lesson selected.");
        }
      } catch (error) {
        console.error("Failed to fetch quiz:", error);
        setError("Could not load quiz. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchdata();
  }, [lessonId]);

  const getnextquestion = async () => {
    if (questionnumber === quiz.length - 1) {
      // Last question — save quiz completion score
      if (lessonId && !scoreSaved) {
        try {
          await apiClient.put(`/user-lessons/${lessonId}`, {
            quiz_score: 100,        // completed all flashcards = 100%
            practice_completed: true,
          });
          setScoreSaved(true);
          alert("Quiz complete! Score saved. ✅");
        } catch (err) {
          console.error("Failed to save quiz score:", err);
          alert("You finished all questions!");
        }
      } else {
        alert("You finished all questions!");
      }
    } else {
      setquestionnumber(prev => prev + 1);
      setshowanswers(0);
    }
  };

  const getprevquestion = () => {
    if (questionnumber === 0) return;
    setquestionnumber(prev => prev - 1);
  };

  const rotation = () => {
    setshowanswers(prev => (prev === 2 ? 0 : prev + 1));
  };

  if (loading) return <div className="p-5 text-muted text-center">Loading quiz...</div>;
  if (error) return (
    <div className="p-5 text-center">
      <div className="alert alert-warning">{error}</div>
      <Button variant="secondary" onClick={() => navigate("/lesson", { state: location.state })}>
        Return to Session
      </Button>
    </div>
  );
  if (quiz.length === 0) return (
    <div className="p-5 text-center">
      <p>No questions available.</p>
      <Button variant="secondary" onClick={() => navigate("/lesson", { state: location.state })}>
        Return to Session
      </Button>
    </div>
  );

  return (
    <>
      <div className='root'>
        <MotionDiv
          className='quizheader'
          animate={showanswers > 0 ? { rotate: [0, 360, 0] } : { rotate: 0 }}
          transition={{ duration: 1, ease: easeInOut }}
          onClick={rotation}
          key={showanswers}
        >
          <div className='div1'>
            <div className='icondq'><i className="bi bi-lightbulb iconq"></i></div>
            <p className='div1pq'>QUESTION</p>
          </div>
          <div>
            <h3 className='quizh3'>{quiz[questionnumber].question}</h3>
            <div className='btndiv'>
              <Button variant="secondary" className='showflashbtn prev' onClick={(e) => { e.stopPropagation(); getprevquestion(); }}>
                Previous Question
              </Button>
              <Button variant="secondary" className='showflashbtn next' onClick={(e) => { e.stopPropagation(); getnextquestion(); }}>
                Next Question
              </Button>
            </div>
          </div>

          {showanswers === 1 && (
            <div className='bodyq'>
              <div className='div1'>
                <div className='icondq part2a'>✔</div>
                <p className='div1pq part3'>Answer</p>
              </div>
              <p className='answerp'>{quiz[questionnumber].answer}</p>
              <br />
              <div className='div1'>
                <div className='icondq part2a blue'>✔</div>
                <p className='div1pq part3'>WHY THIS IS CORRECT</p>
              </div>
              <p className='answerp'>{quiz[questionnumber].why_correct}</p>
              <br />
            </div>
          )}

          {showanswers === 2 && (
            <>
              <div className='div1'>
                <div className='icondq part2a'><i className="bi bi-exclamation-triangle icccc"></i></div>
                <p className='div1pq part3'>COMMON MISTAKES</p>
              </div>
              <p className='answerp'>{quiz[questionnumber].common_mistake}</p>
              <br />
            </>
          )}
        </MotionDiv>

        <Button
          variant="secondary"
          className='showflashbtn next return'
          onClick={() => navigate("/lesson", { state: location.state })}
        >
          Return To Session
        </Button>
      </div>
    </>
  );
};

export default QuizFlashcards;