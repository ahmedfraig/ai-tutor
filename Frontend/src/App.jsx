import "./App.css";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";

import Home from "./Components/Home";
import Mylearning from "./Components/Mylearning";
import Reminder from "./Components/Reminder";
import Lesson from "./Components/Lesson";
import Login from "./Components/Authentication/Login";
import Register from "./Components/Authentication/Register";
import ProtectedRoute from "./Components/Authentication/ProtectedRoute";
import ExamStart from "./Components/mylearningComponents/ExamStart";
import QuizFlashcards from './Components/mylearningComponents/QuizFlashcards';
import Profile from './Components/Profile';

function App() {
  return (
    <AuthProvider>

      <Toaster position="top-center" reverseOrder={false} />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mylearning"
          element={
            <ProtectedRoute>
              <Mylearning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reminder"
          element={
            <ProtectedRoute>
              <Reminder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson"
          element={
            <ProtectedRoute>
              <Lesson />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
       <Route
  path="/examstart"
  element={
    <ProtectedRoute>
      <ExamStart />
    </ProtectedRoute>
  }
  
/>

 <Route
  path="/flashcardquiz"
  element={
    <ProtectedRoute>
      <QuizFlashcards/>
    </ProtectedRoute>
  }
/>

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
