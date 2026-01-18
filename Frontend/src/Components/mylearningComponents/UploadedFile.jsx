import React from "react";
import "./UploadedFile.css";
import { BsFileEarmarkText, BsBook, BsDownload } from "react-icons/bs";

// 1. Accept props here
const UploadedFile = ({ fileName }) => { 
  return (
    <div className="preview-card">
      <div className="icon-container">
        <BsFileEarmarkText className="file-icon" />
      </div>

      {/* 2. Use the fileName prop */}
      <h3 className="file-name">{fileName || "Select a file"}</h3>
      <p className="file-status">Document ready to view</p>

      <div className="button-group">
        <button className="btn btn-primary">
          <BsBook className="btn-icon" />
          Open Preview
        </button>
        <button className="btn btn-secondary">
          <BsDownload className="btn-icon" />
          Download
        </button>
      </div>
    </div>
  );
};

export default UploadedFile;