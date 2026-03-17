import React, { useState, useRef, useEffect } from "react";
import "./UploadedFile.css";
import { BsFileEarmarkText, BsBook, BsDownload, BsXCircle } from "react-icons/bs";

// fileUrl  = server URL for a DB-stored file (e.g. http://localhost:5000/uploads/...)
// file     = local JS File object (just after a fresh upload before page refresh)
// onUpload = callback to add a totally new file (not used for already-stored files)
const UploadedFile = ({ fileName, file, fileUrl, onUpload }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [localUrl, setLocalUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Derive the URL to use: prefer server URL, fall back to local blob URL
  const activeUrl = fileUrl || localUrl;

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setLocalUrl(null);
      setShowPreview(false);
    }
  }, [file]);

  // When we switch to a new file (fileUrl changes), close any open preview
  useEffect(() => {
    setShowPreview(false);
  }, [fileUrl]);

  const togglePreview = () => {
    if (!activeUrl) return;
    setShowPreview((s) => !s);
  };

  const handleDownload = () => {
    if (!activeUrl) return;
    const link = document.createElement("a");
    link.href = activeUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasFile = !!activeUrl;

  return (
    <div className="preview-card">
      {/* Hidden input — only used if the parent wants re-upload capability */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.target.files[0];
          if (f) onUpload(f);
          setShowPreview(false);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        accept="application/pdf"
      />

      {/* CONTENT AREA */}
      {showPreview && activeUrl ? (
        <div className="pdf-preview-container">
          <object data={activeUrl} type="application/pdf" width="100%" height="500px">
            <p>Your browser does not support PDFs. <a href={activeUrl}>Download the PDF</a>.</p>
          </object>
        </div>
      ) : (
        <div className="file-info-area" style={{ cursor: "default" }}>
          <div className="icon-container">
            <BsFileEarmarkText className="file-icon" />
          </div>
          <h3 className="file-name">{fileName}</h3>
          <p className="file-status">
            {hasFile ? "Document ready to view" : "File not available"}
          </p>
        </div>
      )}

      {/* BUTTON GROUP */}
      <div className="button-group">
        <button
          className={`btn ${showPreview ? "btn-secondary" : "btn-primary"}`}
          onClick={togglePreview}
          disabled={!hasFile}
        >
          {showPreview ? <BsXCircle className="btn-icon" /> : <BsBook className="btn-icon" />}
          {showPreview ? "Close Preview" : "Open Preview"}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleDownload}
          disabled={!hasFile}
        >
          <BsDownload className="btn-icon" />
          Download
        </button>
      </div>
    </div>
  );
};

export default UploadedFile;