import React, { useState, useEffect, useRef } from "react";
import { Accordion, Button, ListGroup, Spinner, Modal } from "react-bootstrap";
import { BsX, BsPencil, BsTrash, BsCheck, BsXCircle } from "react-icons/bs";
import apiClient from "../../api/apiClient";
import "./Sidebar.css";

function Sidebar({ onCloseSidebar, onSelectContent, lessonId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [openAccordion, setOpenAccordion] = useState("0");

  // Rename state
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef(null);

  // Custom delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }

  // ── Fetch files from DB ──────────────────────────────────────
  const fetchFiles = async () => {
    if (!lessonId) return;
    try {
      setLoading(true);
      const { data } = await apiClient.get(`/lesson-files/${lessonId}`);
      setFiles(data);

      // Auto-select first video (or first uploaded file) on load
      const firstVideo = data.find((f) => f.type === "video");
      const firstFile = data[0];
      const toSelect = firstVideo || firstFile;
      if (toSelect && activeId === null) {
        setActiveId(toSelect.id);
        onSelectContent(toSelect.type, toSelect.name, toSelect.file_path);
        setOpenAccordion(toSelect.type === "video" ? "1" : toSelect.type === "audio" ? "2" : "0");
      }
    } catch (err) {
      console.error("Error fetching lesson files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line
  }, [lessonId]);

  useEffect(() => {
    if (editingId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  // ── Derived lists ────────────────────────────────────────────
  const uploadedFiles = files.filter((f) => f.type === "upload");
  const videos        = files.filter((f) => f.type === "video");
  const audios        = files.filter((f) => f.type === "audio");

  // ── Upload File ──────────────────────────────────────────────
  const fileInputRef = useRef(null);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file || !lessonId) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lesson_id", lessonId);

    try {
      const { data } = await apiClient.post("/lesson-files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFiles((prev) => [...prev, data]);
      setActiveId(data.id);
      onSelectContent("upload", data.name, data.file_path);
      setOpenAccordion("0");
    } catch (err) {
      console.error("Upload failed:", err);
    }
    e.target.value = "";
  };

  // ── Generate (AI-generated placeholder record) ───────────────
  const handleGenerate = async (type) => {
    if (!lessonId) return;
    const label = type === "video" ? "AI Video" : "AI Audio";
    const count = (type === "video" ? videos : audios).length + 1;
    const name = `${label} ${count}`;

    try {
      const { data } = await apiClient.post("/lesson-files", {
        lesson_id: lessonId,
        type,
        name,
      });
      setFiles((prev) => [...prev, data]);
      setActiveId(data.id);
      onSelectContent(type, data.name, data.file_path);
      setOpenAccordion(type === "video" ? "1" : "2");
    } catch (err) {
      console.error("Generate failed:", err);
    }
  };

  // ── Select ───────────────────────────────────────────────────
  const handleSelect = (record) => {
    if (editingId !== null) return;
    setActiveId(record.id);
    onSelectContent(record.type, record.name, record.file_path);
  };

  // ── Rename ───────────────────────────────────────────────────
  const startEdit = (e, record) => {
    e.stopPropagation();
    setEditingId(record.id);
    setEditingName(record.name);
  };

  const saveEdit = async (id) => {
    if (!editingName.trim()) { cancelEdit(); return; }
    try {
      const { data } = await apiClient.put(`/lesson-files/${id}`, { name: editingName.trim() });
      setFiles((prev) => prev.map((f) => (f.id === id ? data : f)));
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setEditingId(null);
    setEditingName("");
  };

  const cancelEdit = () => { setEditingId(null); setEditingName(""); };

  // ── Delete (custom modal) ────────────────────────────────────
  const askDelete = (e, record) => {
    e.stopPropagation();
    setDeleteTarget(record);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await apiClient.delete(`/lesson-files/${id}`);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (activeId === id) {
        setActiveId(null);
        onSelectContent("video", "", null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ── Render a single list item ────────────────────────────────
  const renderItem = (record) => (
    <ListGroup.Item
      key={record.id}
      action
      active={activeId === record.id}
      onClick={() => handleSelect(record)}
      className="d-flex align-items-center justify-content-between sidebar-file-item"
    >
      {editingId === record.id ? (
        <div className="d-flex align-items-center gap-1 w-100" onClick={(e) => e.stopPropagation()}>
          <input
            ref={renameInputRef}
            className="form-control form-control-sm"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(record.id);
              if (e.key === "Escape") cancelEdit();
            }}
            onBlur={() => saveEdit(record.id)}
          />
          <BsCheck className="sidebar-icon text-success" onClick={() => saveEdit(record.id)} />
          <BsXCircle className="sidebar-icon text-danger" onClick={cancelEdit} />
        </div>
      ) : (
        <>
          <span className="sidebar-file-name text-truncate">{record.name}</span>
          <span className="sidebar-actions ms-2 d-flex gap-1">
            <BsPencil className="sidebar-icon" title="Rename" onClick={(e) => startEdit(e, record)} />
            <BsTrash className="sidebar-icon text-danger" title="Delete" onClick={(e) => askDelete(e, record)} />
          </span>
        </>
      )}
    </ListGroup.Item>
  );

  return (
    <div className="sidebar-container">
      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelected} />

      {/* ── Custom Delete Confirm Modal ── */}
      <Modal
        show={!!deleteTarget}
        onHide={() => setDeleteTarget(null)}
        centered
        dialogClassName="delete-modal-dialog"
        contentClassName="delete-modal-content"
      >
        <Modal.Body className="text-center px-5 pt-5 pb-4">
          {/* Icon */}
          <div className="delete-modal-icon mb-4">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </div>

          <h4 className="delete-modal-title">Delete this item?</h4>
          <p className="delete-modal-subtitle">
            <span className="delete-modal-filename">"{deleteTarget?.name}"</span>
            {" "}will be permanently removed and cannot be recovered.
          </p>

          <div className="delete-modal-actions">
            <button className="delete-btn-cancel" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="delete-btn-confirm" onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </Modal.Body>
      </Modal>

      <div className="sidebar-header">
        <h4 className="sidebar-title mb-0">Lesson Content</h4>
        <Button variant="link" className="sidebar-close-btn d-xl-none p-0" onClick={onCloseSidebar}>
          <BsX size={28} />
        </Button>
      </div>

      <Button variant="outline-dark" className="w-100 mb-3 sideButtons upload-button" onClick={handleUploadClick}>
        <i className="bi bi-upload me-2"></i> Upload File
      </Button>
      <Button variant="outline-dark" className="w-100 mb-2 sideButtons generate-button" onClick={() => handleGenerate("video")}>
        <i className="bi bi-camera-video me-2"></i> Generate Video
      </Button>
      <Button variant="outline-dark" className="w-100 mb-3 sideButtons generate-button" onClick={() => handleGenerate("audio")}>
        <i className="bi bi-mic me-2"></i> Generate Audio
      </Button>

      {loading ? (
        <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
      ) : (
        <Accordion activeKey={openAccordion} onSelect={(e) => setOpenAccordion(e)}>
          <Accordion.Item eventKey="0" className="accordion-item-custom">
            <Accordion.Header>
              Uploaded Files{" "}
              {uploadedFiles.length > 0 && <span className="badge bg-secondary ms-2">{uploadedFiles.length}</span>}
            </Accordion.Header>
            <Accordion.Body>
              {uploadedFiles.length === 0
                ? <p className="text-muted small mb-0">No files uploaded yet.</p>
                : <ListGroup variant="flush">{uploadedFiles.map(renderItem)}</ListGroup>}
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="1" className="accordion-item-custom">
            <Accordion.Header>
              AI-Generated Videos{" "}
              {videos.length > 0 && <span className="badge bg-secondary ms-2">{videos.length}</span>}
            </Accordion.Header>
            <Accordion.Body>
              {videos.length === 0
                ? <p className="text-muted small mb-0">No videos generated yet.</p>
                : <ListGroup variant="flush">{videos.map(renderItem)}</ListGroup>}
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="2" className="accordion-item-custom">
            <Accordion.Header>
              AI-Generated Audios{" "}
              {audios.length > 0 && <span className="badge bg-secondary ms-2">{audios.length}</span>}
            </Accordion.Header>
            <Accordion.Body>
              {audios.length === 0
                ? <p className="text-muted small mb-0">No audios generated yet.</p>
                : <ListGroup variant="flush">{audios.map(renderItem)}</ListGroup>}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}
    </div>
  );
}

export default Sidebar;