import { Link } from 'react-router-dom';
import './Register.css'; // reuse auth page styles

const CheckEmail = () => {
  return (
    <div className="register-container">
      <header className="registerheader">
        <div className="logo-box"><i className="bi bi-book"></i></div>
        <h2>Papyrus</h2>
        <p>One more step</p>
      </header>

      <main className="registermain">
        <div className="registerform" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>

          <h3 className="register-title">Check your inbox</h3>
          <p style={{ color: 'var(--text-muted, #888)', lineHeight: 1.6, marginBottom: 8 }}>
            We sent a verification link to your email address.
            Click the link in that email to activate your account.
          </p>
          <p style={{ color: 'var(--text-muted, #888)', fontSize: 13, marginBottom: 28 }}>
            The link expires in <strong>24 hours</strong>. Check your spam folder if you don't see it.
          </p>

          <Link to="/login" style={{ color: 'var(--accent, #ff6900)', fontSize: 14 }}>
            Already verified? Sign in →
          </Link>
        </div>
      </main>
    </div>
  );
};

export default CheckEmail;
