import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  // Now we check for the JWT token (set by Login.jsx on successful login)
  const token = localStorage.getItem("token");

  if (!token) return <Navigate to="/login" replace />;

  return children;
}