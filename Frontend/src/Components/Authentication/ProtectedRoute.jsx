import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '../../api/apiClient';

// MED-3: ProtectedRoute no longer checks localStorage for a token
// (the token is in an HttpOnly cookie — JS cannot read it).
// Instead, it makes a lightweight API call to verify the cookie is valid.
// If the server returns 401, the cookie is missing/expired → redirect to login.
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'unauthed'

  useEffect(() => {
    apiClient.get('/users/profile')
      .then(() => setStatus('authed'))
      .catch(() => setStatus('unauthed'));
  }, []);

  if (status === 'checking') {
    // Avoid flashing the login page while verifying — show nothing
    return null;
  }

  if (status === 'unauthed') {
    return <Navigate to="/login" replace />;
  }

  return children;
}