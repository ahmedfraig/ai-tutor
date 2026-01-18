import React from "react";
import "./AudioPlayer.css";
import { BsMusicNoteBeamed, BsPlayFill } from "react-icons/bs";

const AudioPlayer = ({ title }) => {
  // Fake waveform data for the visual effect
  const waveformBars = [
    20, 40, 30, 50, 40, 60, 30, 50, 40, 30, 
    20, 40, 50, 60, 70, 50, 40, 60, 50, 40,
    30, 20, 40, 30, 50, 40, 60, 30, 50, 40
  ];

  return (
    <div className="audio-player-container">
      {/* Top Icon */}
      <div className="icon-wrapper">
        <BsMusicNoteBeamed className="music-icon" />
      </div>

      {/* Text Info */}
      <h3 className="track-title">{title || "Audio 1: Quick Review Summary"}</h3>
      <p className="track-subtitle">AI Voice Lesson • 5:20</p>

      {/* Visual Waveform */}
      <div className="waveform">
        {waveformBars.map((height, index) => (
          <div 
            key={index} 
            className="wave-bar" 
            style={{ height: `${height}%` }}
          ></div>
        ))}
      </div>

      {/* Play Button */}
      <button className="play-btn">
        <BsPlayFill size={32} />
      </button>
    </div>
  );
};

export default AudioPlayer;