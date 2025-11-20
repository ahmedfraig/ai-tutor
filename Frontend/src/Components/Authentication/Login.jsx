import React, { useState } from "react";
import "./Login.css";
import { useNavigate, Link } from "react-router-dom";
import toast from 'react-hot-toast';

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password.trim()) newErrors.password = "Password is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const users = JSON.parse(localStorage.getItem("users")) || [];
    const foundUser = users.find(
      (user) => user.email === email && user.password === password
    );

    if (!foundUser) {
      setErrors({ login: "Invalid email or password" });
      return;
    }

    // Save session (optional)
    localStorage.setItem(
      "loggedUser",
      JSON.stringify({
        fullname: foundUser.fullname,
        email: foundUser.email,
      })
    );

    toast.success("Logged in successfully!");
    navigate("/home"); // change to your home page route
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

          <button>Sign In</button>

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
