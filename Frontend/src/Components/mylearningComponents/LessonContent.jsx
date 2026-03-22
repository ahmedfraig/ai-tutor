import React, { useEffect, useState } from "react";
import { Nav, Tab } from "react-bootstrap";
import UploadedFile from "./UploadedFile";
import VideoPlayer from "./VideoPlayer";
import AudioPlayer from "./AudioPlayer";
import AnalyticsSection from "./AnalyticsSection";
import ExamSection from "./ExamSection";
import Quiz from "./Quiz";
import "./LessonContent.css";
import apiClient from "../../api/apiClient";
import DomPurify from 'dompurify';

function LessonContent({ mode, selectedName, selectedFilePath, currentFile, onFileUpload, lessonId, lessonTitle }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [summarize, setSummarize] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) {
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      setLoading(true);
      try {
        // Fetch saved summary from our backend (ai_generations table)
        const res = await apiClient.get(
          `/ai-generations/lesson/${lessonId}?type=summary`
        );
        const records = res.data;
        if (records.length > 0) {
          // Use the most recent summary
          setSummarize(records[0].content || "");
        } else {
          setSummarize("");
        }
      } catch (error) {
        console.error("Failed to fetch summary:", error);
        setSummarize("");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [lessonId]);

  return (
    <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
      <h5 className="">{selectedName}</h5>
      <div>
        {mode === "upload" && (
          <UploadedFile
            fileName={selectedName}
            file={currentFile}
            fileUrl={selectedFilePath
              ? (selectedFilePath.startsWith('http')
                  ? selectedFilePath
                  : `${apiClient.defaults.baseURL?.replace('/api', '') || ''}/${selectedFilePath}`)
              : null}
            onUpload={onFileUpload}
          />
        )}

        {mode === "video" && <VideoPlayer title={selectedName} />}
        {mode === "audio" && <AudioPlayer title={selectedName} />}
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
          {loading ? (
            <div>Loading summary...</div>
          ) : summarize ? (
            <div dangerouslySetInnerHTML={{ __html: DomPurify.sanitize(summarize) }} />
          ) : (
            <div className="text-muted mt-2">
              No summary available for this lesson yet.
            </div>
          )}
        </Tab.Pane>

        <Tab.Pane eventKey="quiz">
          <Quiz lessonId={lessonId} lessonTitle={lessonTitle} />
        </Tab.Pane>

        <Tab.Pane eventKey="exam">
          <ExamSection lessonId={lessonId} lessonTitle={lessonTitle} />
        </Tab.Pane>

        <Tab.Pane eventKey="analytics">
          <AnalyticsSection lessonId={lessonId} />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  );
}

export default LessonContent;