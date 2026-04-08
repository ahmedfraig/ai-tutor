import React, { useState, useEffect } from "react";
import "./Login.css";
import { useNavigate, Link } from "react-router-dom";
import toast from 'react-hot-toast';
import apiClient from "../../api/apiClient";
import { useAuth } from "../../contexts/useAuth";

const Login = () => {
  const navigate = useNavigate();
  const { setAuthStatus } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-apply saved dark mode preference (no toggle needed on auth pages)
  useEffect(() => {
    if (localStorage.getItem('darkmode') === 'true') {
      document.body.classList.add('darkmode');
    } else {
      document.body.classList.remove('darkmode');
    }
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password.trim()) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { user } = res.data;

      // Auth is handled by the HttpOnly cookie set by the server.
      // Only save non-sensitive display data (name/email) for the UI.
      localStorage.setItem('user', JSON.stringify(user));

      // Tell the AuthContext the user is now authenticated so
      // ProtectedRoute lets them through without another API call.
      setAuthStatus('authed');

      toast.success('Logged in successfully!');
      navigate('/home');
    } catch (err) {
      const message = err.response?.data?.message || "Invalid email or password";
      setErrors({ login: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="loginheader container-fluid">
        <div>
          <i className="bi bi-book"></i>
        </div>
        <h2>Welcome to Papyrus</h2>
        <p>Your AI-powered learning companion</p>
      </header>

      <main className="loginmain">
        <form className="loginform" onSubmit={handleSubmit}>
          <p className="loginp1">Sign in to your account</p>

          {errors.login && <p className="error">{errors.login}</p>}

          {/* Email */}
          <label>Email</label>
          <input
            type="email"
            placeholder="Enter Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <p className="error">{errors.email}</p>}

          {/* Password */}
          <label>Password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Your Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <i
              className={`bi ${showPassword ? "bi-eye" : "bi-eye-slash"}`}
              style={{
                position: "absolute",
                right: "15px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
              onClick={() => setShowPassword(!showPassword)}
            ></i>
          </div>
          {errors.password && <p className="error">{errors.password}</p>}

          <button disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>

          <p className="loginp2">
            Don't have an account?
            <Link to="/register">Sign up</Link>
          </p>
        </form>
      </main>

      <footer className="loginfooter">
        <p>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </footer>
    </>
  );
};

export default Login;
