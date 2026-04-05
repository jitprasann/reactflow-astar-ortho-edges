import React from "react";

var zoomBarStyle = {
    position: "absolute",
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    zIndex: 5,
    pointerEvents: "auto",
};

export default function ZoomBar({ zoomLevel, onChange }) {
    return (
        <div style={zoomBarStyle}>
            <span>{zoomLevel}%</span>
            <input
                type="range"
                min={0}
                max={100}
                step={2}
                value={zoomLevel}
                onChange={onChange}
                style={{ width: 120 }}
            />
        </div>
    );
}
