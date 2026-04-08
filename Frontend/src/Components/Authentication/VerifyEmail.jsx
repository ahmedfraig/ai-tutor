import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import './Register.css'; // reuse auth page styles

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'expired' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    apiClient.get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setMessage(res.data.message);
        setStatus(res.data.expired ? 'expired' : 'success');
      })
      .catch((err) => {
        const data = err.response?.data;
        setMessage(data?.message || 'Verification failed. Please try again.');
        setStatus(data?.expired ? 'expired' : 'error');
      });
  }, []);

  const icons = {
    loading: '⏳',
    success: '✅',
    expired: '⏰',
    error:   '❌',
  };

  return (
    <div className="register-container">
      <header className="registerheader">
        <div className="logo-box"><i className="bi bi-book"></i></div>
        <h2>Papyrus</h2>
        <p>Email Verification</p>
      </header>

      <main className="registermain">
        <div className="registerform" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>
            {icons[status] || '📧'}
          </div>

          {status === 'loading' && (
            <>
              <h3 className="register-title">Verifying your email…</h3>
              <p style={{ color: 'var(--text-muted, #888)' }}>Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <h3 className="register-title">Email Verified!</h3>
              <p style={{ color: 'var(--text-muted, #888)', marginBottom: 24 }}>{message}</p>
              <Link to="/login" className="register-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Sign In Now
              </Link>
            </>
          )}

          {(status === 'expired' || status === 'error') && (
            <>
              <h3 className="register-title">
                {status === 'expired' ? 'Link Expired' : 'Verification Failed'}
              </h3>
              <p style={{ color: 'var(--text-muted, #888)', marginBottom: 24 }}>{message}</p>
              <Link to="/register" className="register-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Register Again
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default VerifyEmail;
