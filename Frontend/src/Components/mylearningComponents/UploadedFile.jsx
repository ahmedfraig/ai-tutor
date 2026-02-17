import React, { useState, useRef, useEffect } from "react";
import "./UploadedFile.css";
import { BsFileEarmarkText, BsBook, BsDownload, BsXCircle } from "react-icons/bs";

const UploadedFile = ({ fileName, file, onUpload }) => {
  
  const [showPreview, setShowPreview] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);      
      return () => URL.revokeObjectURL(url);
    } else {
      setFileUrl(null);
      setShowPreview(false);
    }
  }, [file]);

  // 2. Handle File Selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      onUpload(selectedFile);
      setShowPreview(false); 
    }
  };

  const triggerUpload = () => {
    fileInputRef.current.click();
  };

  const togglePreview = () => {
    if (!file) {
        alert("Please upload a file first!");
        return;
    }
    setShowPreview(!showPreview);
  };

  const handleDownload = () => {
    if (!file) {
        alert("Please upload a file first!");
        return;
    }
    
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
  };

  return (
    <div className="preview-card">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
        accept="application/pdf"
      />

      {/* --- CONTENT AREA --- */}
      {showPreview && file && fileUrl ? (
        <div className="pdf-preview-container">
          <object
            data={fileUrl}
            type="application/pdf"
            width="100%"
            height="500px"
          >
            <p>Your browser does not support PDFs. <a href={fileUrl}>Download the PDF</a>.</p>
          </object>
        </div>
      ) : (
        <div className="file-info-area" onClick={!file ? triggerUpload : undefined} style={{cursor: !file ? 'pointer' : 'default'}}>
          <div className="icon-container">
            <BsFileEarmarkText className="file-icon" />
          </div>
          <h3 className="file-name">
            {/* Display the file name if it exists, otherwise the Lesson Name */}
            {file ? file.name : `Select PDF for ${fileName}`}
          </h3>
          <p className="file-status">
            {file ? "Document ready to view" : "Click to upload"}
          </p>
        </div>
      )}

      {/* --- BUTTON GROUP --- */}
      <div className="button-group">
        <button 
            className={`btn ${showPreview ? "btn-secondary" : "btn-primary"}`} 
            onClick={togglePreview}
            disabled={!file}
        >
          {showPreview ? <BsXCircle className="btn-icon" /> : <BsBook className="btn-icon" />}
          {showPreview ? "Close Preview" : "Open Preview"}
        </button>

        <button 
            className="btn btn-secondary" 
            onClick={handleDownload}
            disabled={!file}
        >
          <BsDownload className="btn-icon" />
          Download
        </button>
      </div>
    </div>
  );
};

export default UploadedFile;