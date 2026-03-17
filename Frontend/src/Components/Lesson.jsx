import React, { useState, useEffect } from "react";
import { Container, Row, Col, Button, ToastContainer, Toast } from "react-bootstrap";
import { useLocation } from "react-router-dom";
import LearningHeader from "./mylearningComponents/LearningHeader";
import Sidebar from "./mylearningComponents/Sidebar";
import LessonContent from "./mylearningComponents/LessonContent";
import AITutorPanel from "./mylearningComponents/AITutorPanel";
import "./Lesson.css";
import apiClient from "../api/apiClient";

function Lesson() {
  const location = useLocation();
  const { lessonId, lessonTitle } = location.state || {};

  const [showSidebar, setShowSidebar] = useState(false);
  const [mode, setMode] = useState("video");
  const [selectedName, setSelectedName] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [lessonFiles, setLessonFiles] = useState({});

  const showToast = (message) => setToast({ show: true, message });

  // --- Progress Tracking ---
  useEffect(() => {
    if (!lessonId) return;

    const entryTime = Date.now();

    // Init or update the tracking record when the lesson opens
    const initTracking = async () => {
      try {
        await apiClient.post(`/user-lessons/${lessonId}`, {
          last_entered: new Date().toISOString(),
        });
      } catch (err) {
        // 409 = record already exists, update last_entered instead
        if (err.response?.status === 409) {
          await apiClient.put(`/user-lessons/${lessonId}`, {
            last_entered: new Date().toISOString(),
          });
        }
      }
    };

    initTracking();

    // On unmount: save total time spent in this session (seconds)
    return () => {
      const secondsSpent = Math.floor((Date.now() - entryTime) / 1000);
      if (secondsSpent < 2) return; // ignore accidental page flashes
      // Fire-and-forget: save time spent
      apiClient.put(`/user-lessons/${lessonId}`, {
        time_spent: secondsSpent,
        last_entered: new Date().toISOString(),
      }).catch(() => {/* silent */});
    };
  }, [lessonId]);

  // Track videos watched when content is selected
  const handleSelectContent = (type, name, filePath = null) => {
    setMode(type);
    setSelectedName(name);
    setSelectedFilePath(filePath);
    showToast(
      type === "video" ? `🎬 Opened ${name}` :
      type === "audio" ? `🎧 Playing ${name}` : `📄 Opened ${name}`
    );
    // Increment videos_watched_count when a video is opened
    if (type === "video" && lessonId) {
      apiClient.put(`/user-lessons/${lessonId}`, {
        videos_watched_count: 1,
      }).catch(() => {});
    }
  };

  const handleGenerate = (type) => {
    setMode(type);
    const generatedName = type === "video" ? "AI Video Generated" : "AI Audio Generated";
    setSelectedName(generatedName);
    showToast(type === "video" ? "🎥 Video generated successfully!" : "🎧 Audio generated successfully!");
  };

  const handleUpload = () => {
    setMode("upload");
    setSelectedName("Uploaded File");
    showToast("📄 Ready to upload!");
  };

  const handleFileUpdate = (file) => {
    setLessonFiles((prevFiles) => ({ ...prevFiles, [selectedName]: file }));
    showToast("📄 File saved for " + selectedName);
  };

  return (
    <>
      <LearningHeader lessonTitle={lessonTitle} />

      <Container fluid className="vh-100 bg-light position-relative">
        <Row className="h-100">
          <Col
            xl={2}
            className={`sidebarlearning bg-white border-end position-absolute position-xl-static ${
              showSidebar ? "d-block" : "d-none d-xl-block"
            }`}
            style={{ zIndex: 1050 }}
          >
            <Sidebar
              onCloseSidebar={() => setShowSidebar(false)}
              onSelectContent={handleSelectContent}
              onGenerate={handleGenerate}
              onUpload={handleUpload}
              lessonId={lessonId}
            />
          </Col>

          <Col xl={10} sm={12} className="h-100 offset-xl-2 px-xl-4 learningContainer">
            <Button
              variant="primary"
              className="d-xl-none mb-3 menu-button"
              onClick={() => setShowSidebar(true)}
            >
              <i className="bi bi-list"></i> Menu
            </Button>

            <LessonContent
              mode={mode}
              selectedName={selectedName}
              selectedFilePath={selectedFilePath}
              currentFile={lessonFiles[selectedName]}
              onFileUpload={handleFileUpdate}
              lessonId={lessonId}
              lessonTitle={lessonTitle}
            />
            <AITutorPanel lessonTitle={lessonTitle} />
          </Col>
        </Row>

        <ToastContainer position="bottom-end" className="p-3">
          <Toast
            show={toast.show}
            onClose={() => setToast({ ...toast, show: false })}
            delay={3000}
            autohide
          >
            <Toast.Body>{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </>
  );
}

export default Lesson;