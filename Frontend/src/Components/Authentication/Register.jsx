import React, { useState, useEffect } from 'react';
import './Register.css';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../api/apiClient';


const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    if (!formData.fullname.trim()) newErrors.fullname = "Full name is required";
    else if (formData.fullname.length < 3) newErrors.fullname = "Full name must be at least 3 characters";

    if (!formData.email.trim()) newErrors.email = "Email is required";
    else {
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(formData.email)) newErrors.email = "Invalid email format";
    }

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";

    if (!formData.confirmPassword) newErrors.confirmPassword = "Confirm your password";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!formData.terms) newErrors.terms = "You must agree before creating an account";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await apiClient.post('/auth/register', {
        full_name: formData.fullname,
        email: formData.email,
        password: formData.password,
      });

      toast.success("Account created successfully!");
      navigate("/login");
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed. Please try again.";
      if (message.toLowerCase().includes("email")) {
        setErrors({ email: message });
      } else {
        setErrors({ general: message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <header className='registerheader'>
        <div className="logo-box"><i className="bi bi-book"></i></div>
        <h2>Join Papyrus</h2>
        <p>Create your account and start learning</p>
      </header>

      <main className='registermain'>
        <form className='registerform' onSubmit={handleSubmit}>
          <h3 className='register-title'>Create your account</h3>

          {errors.general && <p className="error">{errors.general}</p>}

          {/* Full Name */}
          <label htmlFor="fullname">Full Name</label>
          <div className="input-wrapper">
            <i className="bi bi-person input-icon"></i>
            <input
              type="text"
              id="fullname"
              placeholder='Enter your full name'
              value={formData.fullname}
              onChange={(e) => setFormData({...formData, fullname: e.target.value})}
            />
          </div>
          {errors.fullname && <p className="error">{errors.fullname}</p>}

          {/* Email */}
          <label htmlFor="email">Email</label>
          <div className="input-wrapper">
            <i className="bi bi-envelope input-icon"></i>
            <input
              type="email"
              id="email"
              placeholder='Enter your email'
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          {errors.email && <p className="error">{errors.email}</p>}

          {/* Password */}
          <label htmlFor="password">Password</label>
          <div className="input-wrapper">
            <i className="bi bi-lock input-icon"></i>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder='Create a password'
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
            <i
              className={`bi ${showPassword ? 'bi-eye' : 'bi-eye-slash'} password-toggle`}
              onClick={() => setShowPassword(!showPassword)}
            ></i>
          </div>
          {errors.password && <p className="error">{errors.password}</p>}

          {/* Confirm Password */}
          <label htmlFor="confirm-password">Confirm Password</label>
          <div className="input-wrapper">
            <i className="bi bi-lock input-icon"></i>
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirm-password"
              placeholder='Confirm your password'
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
            />
            <i
              className={`bi ${showConfirmPassword ? 'bi-eye' : 'bi-eye-slash'} password-toggle`}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            ></i>
          </div>
          {errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}

          {/* Terms Checkbox */}
          <div className="terms-check">
            <input
              type="checkbox"
              id="terms"
              onChange={(e) => setFormData({...formData, terms: e.target.checked})}
            />
            <label htmlFor="terms">
              I agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>
            </label>
          </div>
          {errors.terms && <p className="error">{errors.terms}</p>}

          <button className="register-btn" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <div className="divider"><span>OR</span></div>

          <p className='register-footer-text'>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
};

export default Register;
