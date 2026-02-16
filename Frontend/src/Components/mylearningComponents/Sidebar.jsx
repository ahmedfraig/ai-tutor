import React, { useState, useEffect } from "react";
import { Accordion, Button, ListGroup } from "react-bootstrap";
import { BsX } from "react-icons/bs";
import "./Sidebar.css";

function Sidebar({ onCloseSidebar, onSelectContent }) {
  const [uploadedFiles, setUploadedFiles] = useState([
    "Newton’s Laws - Lecture Notes.pdf",
    "Force Diagrams.pptx",
  ]);
  const [videos, setVideos] = useState([
    "Video 1: Introduction to Forces",
    "Video 2: Newton’s Second Law",
  ]);
  const [audios, setAudios] = useState(["Lesson Audio.mp3"]);

  const [activeItem, setActiveItem] = useState(null);
  
  // 1. New State: Controls which Accordion tab is open ("0", "1", or "2")
  const [openAccordion, setOpenAccordion] = useState("1"); 

  // Select the first video on initial load
  useEffect(() => {
    if (videos.length > 0 && !activeItem) {
      setActiveItem(videos[0]);
      onSelectContent("video", videos[0]);
    }
    // eslint-disable-next-line
  }, []); // Run once on mount

  const handleUpload = () => {
    const newFile = `UploadedFile_${uploadedFiles.length + 1}.pdf`;
    
    // 1. Add to list
    setUploadedFiles([...uploadedFiles, newFile]);
    
    // 2. Select it immediately
    setActiveItem(newFile);
    onSelectContent("upload", newFile);
    
    // 3. Force "Uploaded Files" tab (Key "0") to open
    setOpenAccordion("0"); 
  };

  const handleGenerate = (type) => {
    if (type === "video") {
      const newVideo = `Generated Video ${videos.length + 1}`;
      
      // 1. Add
      setVideos([...videos, newVideo]);
      
      // 2. Select
      setActiveItem(newVideo);
      onSelectContent("video", newVideo);
      
      // 3. Open Video Tab (Key "1")
      setOpenAccordion("1"); 

    } else {
      const newAudio = `Generated Audio ${audios.length + 1}`;
      
      // 1. Add
      setAudios([...audios, newAudio]);
      
      // 2. Select
      setActiveItem(newAudio);
      onSelectContent("audio", newAudio);
      
      // 3. Open Audio Tab (Key "2")
      setOpenAccordion("2"); 
    }
  };

  const handleSelect = (type, item) => {
    setActiveItem(item);
    onSelectContent(type, item);
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-close-btn d-xl-none">
        <Button variant="link" className="p-0" onClick={onCloseSidebar}>
          <BsX size={28} />
        </Button>
      </div>

      <h4 className="sidebar-title mb-4">Lesson Content</h4>

      <Button
        variant="outline-dark"
        className="w-100 mb-3 sideButtons upload-button"
        onClick={handleUpload}
      >
        <i className="bi bi-upload me-2"></i> Upload File
      </Button>

      <Button
        variant="outline-dark"
        className="w-100 mb-2 sideButtons generate-button"
        onClick={() => handleGenerate("video")}
      >
        <i className="bi bi-camera-video me-2"></i> Generate Video
      </Button>

      <Button
        variant="outline-dark"
        className="w-100 mb-3 sideButtons generate-button"
        onClick={() => handleGenerate("audio")}
      >
        <i className="bi bi-mic me-2"></i> Generate Audio
      </Button>

      {/* We link the Accordion to our state variable using activeKey.
         We also use onSelect to update the state if the user clicks manually.
      */}
      <Accordion 
        activeKey={openAccordion} 
        onSelect={(e) => setOpenAccordion(e)}
      >
        <Accordion.Item eventKey="0" className="accordion-item-custom">
          <Accordion.Header>Uploaded Files</Accordion.Header>
          <Accordion.Body>
            <ListGroup variant="flush">
              {uploadedFiles.map((file, i) => (
                <ListGroup.Item
                  key={i}
                  action
                  active={activeItem === file}
                  onClick={() => handleSelect("upload", file)}
                >
                  {file}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="1" className="accordion-item-custom">
          <Accordion.Header>AI-Generated Videos</Accordion.Header>
          <Accordion.Body>
            <ListGroup variant="flush">
              {videos.map((vid, i) => (
                <ListGroup.Item
                  key={i}
                  action
                  active={activeItem === vid}
                  onClick={() => handleSelect("video", vid)}
                >
                  {vid}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="2" className="accordion-item-custom">
          <Accordion.Header>AI-Generated Audios</Accordion.Header>
          <Accordion.Body>
            <ListGroup variant="flush">
              {audios.map((aud, i) => (
                <ListGroup.Item
                  key={i}
                  action
                  active={activeItem === aud}
                  onClick={() => handleSelect("audio", aud)}
                >
                  {aud}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

export default Sidebar;