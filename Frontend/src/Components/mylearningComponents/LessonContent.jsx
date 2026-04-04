import React, { useEffect, useState } from "react";
import UploadedFile from "./UploadedFile";
import VideoPlayer from "./VideoPlayer";
import AudioPlayer from "./AudioPlayer";
import AnalyticsSection from "./AnalyticsSection";
import ExamSection from "./ExamSection";
import Quiz from "./Quiz";
import "./LessonContent.css";
import apiClient from "../../api/apiClient";
import DomPurify from 'dompurify';

const TABS = [
  { key: "overview",   label: "Overview"   },
  { key: "quiz",       label: "Quiz"       },
  { key: "exam",       label: "Exam"       },
  { key: "analytics",  label: "Analytics"  },
];

function LessonContent({ mode, selectedName, selectedFilePath, selectedFileId, currentFile, onFileUpload, lessonId, lessonTitle }) {
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
        setSummarize(records.length > 0 ? (records[0].content || "") : "");
      } catch (error) {
        console.error("Failed to fetch summary:", error);
        setSummarize("");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [lessonId]);

  const displayTitle = selectedName || lessonTitle || "";

  return (
    <div className="lesson-content-root">
      {/* ── Title ── */}
      {displayTitle && (
        <h1 className="lc-title">{displayTitle}</h1>
      )}

      {/* ── Media area ── */}
      <div className="lc-media-wrap">
        {mode === "upload" && (
          <UploadedFile
            fileName={selectedName}
            file={currentFile}
            fileId={selectedFileId}
            fileUrl={selectedFilePath
              ? (selectedFilePath.startsWith('http')
                  ? selectedFilePath
                  : `${apiClient.defaults.baseURL?.replace('/api', '') || ''}/${selectedFilePath}`)
              : null}
            onUpload={onFileUpload}
          />
        )}
        {mode === "video" && (
          <VideoPlayer title={selectedName} filePath={selectedFilePath} fileId={selectedFileId} lessonId={lessonId} />
        )}
        {mode === "audio" && (
          <AudioPlayer title={selectedName} filePath={selectedFilePath} fileId={selectedFileId} />
        )}
      </div>

      {/* ── Custom Tab navigation ── */}
      <div className="lc-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`lc-tab${activeTab === tab.key ? " lc-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ── */}
      <div className="lc-panel-wrap">

        <div
          className={activeTab === "overview" ? "lc-panel lc-panel--active" : "lc-panel lc-panel--hidden"}
          role="tabpanel"
        >
          <p className="lc-section-label">Lesson Summary</p>
          {loading ? (
            <div className="lc-loading">
              <div className="lc-spinner" role="status" aria-label="Loading summary" />
              <span>Loading summary…</span>
            </div>
          ) : summarize ? (
            <div
              className="lc-summary-body"
              dangerouslySetInnerHTML={{ __html: DomPurify.sanitize(summarize) }}
            />
          ) : (
            <div className="lc-empty-state">
              <span className="lc-empty-icon">📄</span>
              <p>No summary available for this lesson yet.</p>
              <p className="lc-empty-sub">The AI will generate a summary once content is added.</p>
            </div>
          )}
        </div>

        <div
          className={activeTab === "quiz" ? "lc-panel lc-panel--active" : "lc-panel lc-panel--hidden"}
          role="tabpanel"
        >
          <Quiz lessonId={lessonId} lessonTitle={lessonTitle} />
        </div>

        <div
          className={activeTab === "exam" ? "lc-panel lc-panel--active" : "lc-panel lc-panel--hidden"}
          role="tabpanel"
        >
          <ExamSection lessonId={lessonId} lessonTitle={lessonTitle} />
        </div>

        <div
          className={activeTab === "analytics" ? "lc-panel lc-panel--active" : "lc-panel lc-panel--hidden"}
          role="tabpanel"
        >
          <AnalyticsSection lessonId={lessonId} />
        </div>

      </div>
    </div>
  );
}

export default LessonContent;