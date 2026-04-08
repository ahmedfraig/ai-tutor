import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../api/apiClient';
import './Register.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      // Show success even on errors — prevents email enumeration on the frontend too
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <header className="registerheader">
        <div className="logo-box"><i className="bi bi-book"></i></div>
        <h2>Papyrus</h2>
        <p>Reset your password</p>
      </header>

      <main className="registermain">
        <div className="registerform" style={{ padding: '36px 32px' }}>

          {!sent ? (
            <>
              <h3 className="register-title">Forgot your password?</h3>
              <p style={{ color: 'var(--text-muted, #888)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="register-field">
                  <label htmlFor="fp-email">Email address</label>
                  <input
                    id="fp-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="register-btn"
                  disabled={loading}
                  style={{ marginTop: 8 }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
              <h3 className="register-title">Check your inbox</h3>
              <p style={{ color: 'var(--text-muted, #888)', lineHeight: 1.6, marginBottom: 24 }}>
                If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
                The link expires in <strong>1 hour</strong>.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted, #888)' }}>
                Didn't receive it? Check your spam folder.
              </p>
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14 }}>
            <Link to="/login" style={{ color: 'var(--accent, #ff6900)' }}>
              ← Back to Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
