import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const isLogged = localStorage.getItem("loggedUser");

  if (!isLogged) return <Navigate to="/login" replace />;

  return children;
}