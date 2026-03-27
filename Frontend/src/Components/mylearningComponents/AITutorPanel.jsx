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
  const bodyRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() === "") return;

    const newMessage = {
      id: Date.now(),
      text: inputValue.trim(),
      sender: "user",
    };

    setMessages([...messages, newMessage]);
    setInputValue("");

    // -- Demo auto-reply ---
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "That's a great question! Newton's Second Law is represented by the formula F = ma.",
          sender: "tutor",
        },
      ]);
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
        <div className="header1 d-flex justify-content-between align-items-center p-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <div className="ai-icon">🤖</div>
            <div>
              <div className="fw-bold">Ask AI Tutor</div>
              <small className="text-muted">Always here to help</small>
            </div>
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
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                className={`ai-bubble mb-2 ${
                  msg.sender === "user" ? "user-bubble ms-auto" : "ai-bubble-msg me-auto"
                }`}
                initial={{ opacity: 0, x: msg.sender === "user" ? 16 : -16, y: 4 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.22, ease: EASE_OUT_QUART }}
              >
                {msg.text}
              </motion.div>
            ))}
          </AnimatePresence>
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
          />
          <motion.button
            className="btn ai-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            aria-label="Send message"
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
