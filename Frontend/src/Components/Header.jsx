import React, { useState } from "react";
import "../App.css";
import "./Header.css";
import { useNavigate } from "react-router-dom";
import toast from 'react-hot-toast';

const Header = () => {
  const navigate = useNavigate();
  const [darkmode, setdarkmode] = useState(false);
  const [logoutdiv, setlogoutdiv] = useState(false);

  const changemode = () => {
    setdarkmode(!darkmode);
    if (darkmode === false) {
      document.body.classList.add("darkmode");
      document.body.classList.remove("lightmode");
    }
    if (darkmode === true) {
      document.body.classList.add("lightmode");
      document.body.classList.remove("darkmode");
    }
  };

  const openLogoutMenu = () => {
    setlogoutdiv(!logoutdiv);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully!");
    navigate("/login");
  };

  // Read user from localStorage (saved on login)
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const username = user.full_name || "";

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <header className="sticky-top shadow-sm z-3">
      <nav className="navbar navbar-expand-lg bg-body-tertiary py-2">
        <div className="container-fluid">
          
          {/* Brand */}
          <div className="d-flex align-items-center gap-2">
            <div className="bg-dark text-white rounded d-flex align-items-center justify-content-center fw-bold" style={{ width: "32px", height: "32px", fontSize: "18px" }}>
              P
            </div>
            <a 
              className="navbar-brand fw-bold mb-0" 
              href="#" 
              onClick={(e) => { e.preventDefault(); navigate("/home"); }}
              style={{ fontSize: "1.25rem" }}
            >
              Papyrus
            </a>
          </div>

          {/* Toggler for mobile */}
          <button
            className="navbar-toggler border-0 shadow-none px-2"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Collapsible Content */}
          <div className="collapse navbar-collapse" id="navbarNav">
            
            {/* Nav Links */}
            <ul className="navbar-nav mx-auto mb-2 mb-lg-0 gap-1 gap-lg-4 mt-3 mt-lg-0">
              <li className="nav-item">
                <a className="nav-link rounded px-3 py-2 d-flex align-items-center" style={{cursor: 'pointer'}} onClick={() => navigate("/home")}>
                  <i className="bi bi-house-door fs-5 me-2"></i> <span className="fw-medium">Home</span>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link rounded px-3 py-2 d-flex align-items-center" style={{cursor: 'pointer'}} onClick={() => navigate("/mylearning")}>
                  <i className="bi bi-book fs-5 me-2"></i> <span className="fw-medium">My Learning</span>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link rounded px-3 py-2 d-flex align-items-center" style={{cursor: 'pointer'}} onClick={() => navigate("/reminder")}>
                  <i className="bi bi-bell fs-5 me-2"></i> <span className="fw-medium">Reminders</span>
                </a>
              </li>
            </ul>

            {/* Profile & Controls (inside collapse for mobile menu) */}
            <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-3 mt-3 mt-lg-0 border-top pt-3 border-lg-0 pt-lg-0 border-secondary-subtle">
              
              <button
                onClick={changemode}
                className="btn btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center mx-3 mx-lg-0"
                style={{ width: "42px", height: "42px", border: "1px solid #dee2e6" }}
                title="Toggle Dark Mode"
              >
                {darkmode ? "🌙" : "☀️"}
              </button>
              
              <div className="position-relative w-100 px-2 px-lg-0">
                <button 
                  className="btn border-0 p-2 d-flex align-items-center gap-3 rounded w-100 justify-content-start" 
                  onClick={openLogoutMenu}
                  style={{ transition: 'background-color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div 
                    className="d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
                    style={{ 
                      width: "36px", height: "36px", borderRadius: "50%", 
                      backgroundColor: "var(--bs-primary, #6366f1)", fontSize: "14px"
                    }}
                  >
                    {getInitials(username)}
                  </div>
                  <div className="d-flex flex-column align-items-start">
                    <span className="fw-semibold text-nowrap user-select-none" style={{ fontSize: "15px", lineHeight: "1.2" }}>{username}</span>
                    <span className="user-select-none text-muted" style={{ fontSize: "12px", lineHeight: "1.2" }}>Student</span>
                  </div>
                  <i className="bi bi-chevron-down ms-auto text-muted" style={{ fontSize: "12px" }}></i>
                </button>
                
                {logoutdiv && (
                  <div 
                    className="dropdown-menu show position-absolute shadow border-0 rounded-3 mt-2" 
                    style={{ 
                      minWidth: "220px", 
                      zIndex: 1050, 
                      right: "0",
                      left: "auto"
                    }}
                  >
                    <button 
                      className="dropdown-item py-2 px-3 d-flex align-items-center" 
                      onClick={() => { setlogoutdiv(false); navigate("/profile"); }}
                    >
                      <i className="bi bi-person fs-5 me-3 text-secondary"></i> 
                      <span className="fw-medium">Profile</span>
                    </button>
                    <hr className="dropdown-divider my-2" />
                    <button 
                      className="dropdown-item py-2 px-3 d-flex align-items-center text-danger" 
                      onClick={handleLogout}
                    >
                      <i className="bi bi-box-arrow-right fs-5 me-3"></i>
                      <span className="fw-medium">Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
