import React, { useEffect, useState } from "react";
import { Nav, Tab } from "react-bootstrap";
import VideoPlayer from "./VideoPlayer";
import AudioPlayer from "./AudioPlayer";
import AnalyticsSection from "./AnalyticsSection";
import ExamSection from "./ExamSection";
import Quiz from "./Quiz";
import "./LessonContent.css";
import axios from 'axios';
import DomPurify from 'dompurify'
function LessonContent({ mode, selectedName }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [summarize, setsummarize] = useState("");

  useEffect(() => {
    const fetchdata = async () => {
      try {
        const res = await axios.post("http://127.0.0.1:8000/summarize", {});
        setsummarize(res.data.summary || "");
      } catch (error) {
        console.error("Failed to fetch summary:", error);
      }
    };

    fetchdata();
  }, []);

  return (
    <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
      <h5 className="">{selectedName}</h5>
      <div>
        {mode === "video" && <VideoPlayer title={selectedName} />}
        {mode === "audio" && <AudioPlayer title={selectedName} />}
        {mode === "file" && (
          <div className="p-5 text-center border rounded bg-white">
            <i className="bi bi-file-earmark-text fs-1 mb-3 d-block"></i>
            <p>{selectedName}</p>
          </div>
        )}
      </div>

      <Nav variant="tabs" className="mt-3 lesson-tabs">
        <Nav.Item>
          <Nav.Link eventKey="overview">Overview</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="quiz">Quiz</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="exam">Exam</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="analytics">Analytics</Nav.Link>
        </Nav.Item>
      </Nav>

      <Tab.Content className="mt-3">
        <Tab.Pane eventKey="overview">

          <strong>Lesson Summary:</strong>
          {summarize && (
            <div dangerouslySetInnerHTML={{ __html: DomPurify.sanitize(summarize) }} />)}


        </Tab.Pane>

        <Tab.Pane eventKey="quiz">
          <Quiz />
        </Tab.Pane>

        <Tab.Pane eventKey="exam">
          <ExamSection />
        </Tab.Pane>

        <Tab.Pane eventKey="analytics">
          <AnalyticsSection />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>

  );
}

export default LessonContent;
