import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../api/apiClient';
import './Register.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});

  const validate = () => {
    const errs = {};
    if (password.length < 8)        errs.password = 'Password must be at least 8 characters.';
    if (password !== confirm)        errs.confirm  = 'Passwords do not match.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, password });
      toast.success('Password updated! You can now sign in.');
      navigate('/login');
    } catch (err) {
      const data = err.response?.data;
      if (data?.expired) {
        setErrors({ form: 'This reset link has expired. Please request a new one.' });
      } else {
        setErrors({ form: data?.message || 'Failed to reset password. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // No token in URL
  if (!token) {
    return (
      <div className="register-container">
        <header className="registerheader">
          <div className="logo-box"><i className="bi bi-book"></i></div>
          <h2>Papyrus</h2>
        </header>
        <main className="registermain">
          <div className="registerform" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>❌</div>
            <h3 className="register-title">Invalid Link</h3>
            <p style={{ color: 'var(--text-muted, #888)', marginBottom: 24 }}>
              This password reset link is missing or invalid.
            </p>
            <Link to="/forgot-password" className="register-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Request New Link
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="register-container">
      <header className="registerheader">
        <div className="logo-box"><i className="bi bi-book"></i></div>
        <h2>Papyrus</h2>
        <p>Set a new password</p>
      </header>

      <main className="registermain">
        <div className="registerform" style={{ padding: '36px 32px' }}>
          <h3 className="register-title">Choose a new password</h3>
          <p style={{ color: 'var(--text-muted, #888)', marginBottom: 24, fontSize: 14 }}>
            Must be at least 8 characters.
          </p>

          {errors.form && <p className="error" style={{ marginBottom: 16 }}>{errors.form}</p>}

          <form onSubmit={handleSubmit}>
            <div className="register-field">
              <label htmlFor="rp-password">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="rp-password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <i
                  className={`bi ${showPw ? 'bi-eye' : 'bi-eye-slash'}`}
                  style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }}
                  onClick={() => setShowPw(!showPw)}
                />
              </div>
              {errors.password && <p className="error">{errors.password}</p>}
            </div>

            <div className="register-field">
              <label htmlFor="rp-confirm">Confirm Password</label>
              <input
                id="rp-confirm"
                type={showPw ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {errors.confirm && <p className="error">{errors.confirm}</p>}
            </div>

            <button
              type="submit"
              className="register-btn"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
            <Link to="/login" style={{ color: 'var(--accent, #ff6900)' }}>← Back to Sign In</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
