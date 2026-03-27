import React, { useEffect, useState } from "react";
import { Nav } from "react-bootstrap";
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
        const res = await apiClient.get(
          `/ai-generations/lesson/${lessonId}?type=summary`
        );
        const records = res.data;
        if (records.length > 0) {
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
    <div>
      <h5>{selectedName}</h5>

      {/* Media area */}
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

      {/* Tab nav */}
      <Nav
        variant="tabs"
        className="mt-3 lesson-tabs"
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
      >
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

      {/* Tab panels — all kept mounted to prevent API re-fetch on tab switch.
          Visibility controlled via CSS display:none. Active panel gets
          tab-fade-in animation via CSS keyframe. */}
      <div className="mt-3">

        <div className={activeTab === "overview" ? "tab-panel tab-panel--active" : "tab-panel tab-panel--hidden"}>
          <strong>Lesson Summary:</strong>
          {loading ? (
            <div className="d-flex align-items-center gap-2 text-muted mt-3">
              <div className="spinner-border spinner-border-sm" role="status" aria-label="Loading summary" />
              <span>Loading summary…</span>
            </div>
          ) : summarize ? (
            <div dangerouslySetInnerHTML={{ __html: DomPurify.sanitize(summarize) }} />
          ) : (
            <div className="text-muted mt-2">
              No summary available for this lesson yet.
            </div>
          )}
        </div>

        <div className={activeTab === "quiz" ? "tab-panel tab-panel--active" : "tab-panel tab-panel--hidden"}>
          <Quiz lessonId={lessonId} lessonTitle={lessonTitle} />
        </div>

        <div className={activeTab === "exam" ? "tab-panel tab-panel--active" : "tab-panel tab-panel--hidden"}>
          <ExamSection lessonId={lessonId} lessonTitle={lessonTitle} />
        </div>

        <div className={activeTab === "analytics" ? "tab-panel tab-panel--active" : "tab-panel tab-panel--hidden"}>
          <AnalyticsSection lessonId={lessonId} />
        </div>

      </div>
    </div>
  );
}

export default LessonContent;