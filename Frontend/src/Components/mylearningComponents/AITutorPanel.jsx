import React, { useState, useRef, useEffect } from "react";
import "./AITutor.css";
import { LuSend } from 'react-icons/lu';
import { BsX } from "react-icons/bs";
import { BsRobot } from 'react-icons/bs';
import { motion, AnimatePresence } from "framer-motion";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1];

const AITutorPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! I'm your AI Tutor. Ask me anything about Newton's Second Law!",
      sender: "tutor",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false); // prevents double-send
  const bodyRef = useRef(null);
  const timerRef = useRef(null); // tracks pending reply timer for cleanup

  // Auto-scroll to latest message
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  // Cancel any pending reply timer on unmount (prevents memory leak)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSend = () => {
    if (inputValue.trim() === "" || isSending) return;

    const newMessage = {
      id: Date.now(),
      text: inputValue.trim(),
      sender: "user",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setIsSending(true); // block further sends until reply arrives

    // -- Demo auto-reply ---
    timerRef.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "That's a great question! Newton's Second Law is represented by the formula F = ma.",
          sender: "tutor",
        },
      ]);
      setIsSending(false); // unblock sends after reply
    }, 1000);
  };


  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            className="btn btn-primary ai-float-btn"
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Tutor"
            aria-expanded={isOpen}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT_QUART }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
          >
            <BsRobot size={25} aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* AI Tutor Panel */}
      <div className={`ai-tutor-panel ${isOpen ? "open" : ""}`}>
        <div className="ai-panel-header">
          <div className="ai-icon">🤖</div>
          <div className="ai-header-text">
            <div className="fw-bold">Ask AI Tutor</div>
            <small className="text-muted">Always here to help</small>
          </div>
          <button
            className="btn ai-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close AI Tutor"
          >
            <BsX size={25} aria-hidden="true" />
          </button>
        </div>

        {/* Chat Messages */}
        <div
          className="ai-body"
          ref={bodyRef}
          role="log"
          aria-label="AI Tutor conversation"
          aria-live="polite"
          aria-atomic="false"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`ai-bubble mb-2 ${
                msg.sender === "user" ? "user-bubble ms-auto" : "ai-bubble-msg me-auto"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="ai-footer d-flex align-items-center">
          <input
            id="ai-tutor-input"
            type="text"
            className="form-control ai-input"
            placeholder="Ask about this lesson..."
            aria-label="Message AI Tutor"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            maxLength={500}
            disabled={isSending}
          />
          <motion.button
            className="btn ai-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            aria-label={isSending ? "Sending…" : "Send message"}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.12 }}
          >
            <LuSend size={23} aria-hidden="true" />
          </motion.button>
        </div>

        {/* Note */}
        <div className="text-center text-muted ai-note mt-1 mb-2">
          AI responses are generated for demonstration
        </div>
      </div>
    </>
  );
};

export default AITutorPanel;
