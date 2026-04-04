import React from "react";
import { Card, Button, Container } from "react-bootstrap";
import { FaClock } from "react-icons/fa";
import "./ExamSection.css";
import { IoDocumentTextOutline } from "react-icons/io5";
import { PiMedalDuotone } from "react-icons/pi";
import { useNavigate } from "react-router-dom";

const ExamSection = ({ lessonId, lessonTitle }) => {
  const navigate = useNavigate();

  return (
    <Container className="py-5 px-0 exam-section-container">
      <Card className="shadow-sm border-0 text-center exam-card">
        <Card.Body className="p-5">
          <div className="exam-icon-wrapper mb-4">
            <span className="exam-medal-icon">
              <PiMedalDuotone />
            </span>
          </div>

          <Card.Title as="h2" className="fw-normal mb-3 exam-card-title">
            Full Exam Mode
          </Card.Title>
          <Card.Text className="exam-card-text mb-5 px-md-5">
            Take a comprehensive exam to test your understanding of all lesson
            material.
          </Card.Text>

          <div className="d-flex justify-content-center align-items-center exam-card-meta mb-5">
            <span className="me-4">
              <FaClock className="me-2" /> 45 minutes
            </span>
            <span>
              <IoDocumentTextOutline className="me-2" /> 15 questions
            </span>
          </div>

          <Button
            className="w-100 fw-bold py-1 exam-start-btn"
            style={{
              backgroundColor: 'var(--color-accent, #ff6900)',
              borderColor: 'var(--color-accent, #ff6900)',
              color: '#fff',
            }}
            onClick={(e) => {
              e.preventDefault();
              navigate("/examstart", { state: { lessonId, lessonTitle } });
            }}
          >
            Start Exam
          </Button>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ExamSection;
