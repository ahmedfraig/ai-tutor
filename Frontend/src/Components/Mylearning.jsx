import React, { useState, useEffect } from "react";
import Header from "./Header";
import { useNavigate } from "react-router-dom";
import "./Mylearning.css";
import apiClient from "../api/apiClient";
import toast from "react-hot-toast";

const Mylearning = () => {
  const [lessons, setLessons] = useState([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // editingId: which lesson card is in rename mode
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await apiClient.get('/lessons');
        setLessons(res.data);
      } catch (err) {
        console.error("Failed to fetch lessons:", err);
        toast.error("Could not load lessons.");
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, []);

  const createLesson = async () => {
    if (lessonTitle.trim() === "") return;
    setCreating(true);
    try {
      const res = await apiClient.post('/lessons', { title: lessonTitle });
      setLessons((prev) => [res.data, ...prev]);
      setLessonTitle("");
      toast.success("Lesson created!");
      const modalEl = document.getElementById('exampleModal');
      const modal = window.bootstrap?.Modal?.getInstance(modalEl);
      if (modal) modal.hide();
    } catch (err) {
      console.error("Failed to create lesson:", err);
      toast.error("Could not create lesson.");
    } finally {
      setCreating(false);
    }
  };

  const deleteLesson = async (id) => {
    if (!window.confirm("Delete this lesson? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/lessons/${id}`);
      setLessons(prev => prev.filter(l => l.id !== id));
      toast.success("Lesson deleted.");
    } catch (err) {
      console.error("Failed to delete lesson:", err);
      toast.error("Could not delete lesson.");
    }
  };

  const startEdit = (lesson) => {
    setEditingId(lesson.id);
    setEditTitle(lesson.title);
  };

  const saveEdit = async (id) => {
    if (!editTitle.trim()) return;
    try {
      const res = await apiClient.put(`/lessons/${id}`, { title: editTitle });
      setLessons(prev => prev.map(l => l.id === id ? { ...l, title: res.data.title } : l));
      toast.success("Lesson renamed.");
    } catch (err) {
      console.error("Failed to rename lesson:", err);
      toast.error("Could not rename lesson.");
    } finally {
      setEditingId(null);
    }
  };

  return (
    <>
      <Header />

      <header className="mylearningheader">
        <div className="learnhdiv1 col-10">
          <h5>My Learning</h5>
          <p>Continue your learning journey</p>
        </div>
        <div className="learnhdiv2">
          <button
            className="startlessonbtn"
            data-bs-toggle="modal"
            data-bs-target="#exampleModal"
          >
            <i className="bi bi-plus"></i>Start a New Lesson
          </button>

          <div
            className="modal fade"
            id="exampleModal"
            tabIndex="-1"
            aria-labelledby="exampleModalLabel"
            aria-hidden="true"
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <button
                  type="button"
                  className="btn-close "
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
                <h5 className="modal-title" id="exampleModalLabel">
                  Start a New Lesson
                </h5>

                <p className="modp">Create a new learning session</p>
                <label htmlFor="" className="mt-3 mb-3 modl">
                  Lesson Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Lesson Name"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createLesson()}
                />

                <div className="moddiv">
                  <button
                    type="button"
                    className=" mb-4 offset-2 modbtn btn btn-secondary"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className=" mb-4 modbtn btn btn-secondary"
                    onClick={createLesson}
                    disabled={creating}
                  >
                    {creating ? "Creating..." : "Create Lesson"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="learnmain mt-5">
        {loading && <p className="text-center text-muted">Loading lessons...</p>}
        {!loading && lessons.length === 0 && (
          <p className="text-center text-muted">
            No lessons yet. Start by creating a new lesson!
          </p>
        )}
        {lessons.map((item, index) => (
          <div className="div" key={item.id || index}>
            {/* Lesson title — normal or edit mode */}
            {editingId === item.id ? (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '0.5rem' }}>
                <input
                  className="form-control form-control-sm"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(item.id)}
                  autoFocus
                />
                <button
                  className="btn btn-sm btn-dark"
                  onClick={() => saveEdit(item.id)}
                >✓</button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setEditingId(null)}
                >✕</button>
              </div>
            ) : (
              <h6>{item.title}</h6>
            )}

            <label htmlFor="">Progress</label>
            <div className="progress mb-3">
              <div
                className="progress-bar lbar"
                style={{ width: "25%", backgroundColor: "black" }}
              ></div>
            </div>
            <p>
              <i className="bi bi-clock"></i> Total 24 minutes
            </p>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <button
                className="col-10 mb-2"
                onClick={() =>
                  navigate("/lesson", {
                    state: { lessonId: item.id, lessonTitle: item.title },
                  })
                }
              >
                Resume
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                title="Rename"
                style={{ borderRadius: '8px' }}
                onClick={() => startEdit(item)}
              >
                <i className="bi bi-pencil"></i>
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                title="Delete"
                style={{ borderRadius: '8px' }}
                onClick={() => deleteLesson(item.id)}
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </main>
    </>
  );
};

export default Mylearning;
