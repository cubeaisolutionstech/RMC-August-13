import React, { useRef } from "react";

const LiveFeed = ({ onVehicleDetected }) => {
  const videoRef = useRef();
  const canvasRef = useRef();

  const handleCheckVehicle = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      const res = await fetch("http://localhost:8000/anpr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      onVehicleDetected(data.matched_vehicles || []);
    }, "image/jpeg");
  };

  return (
    <div>
      <video ref={videoRef} width="640" height="360" controls>
        <source src="/video/sample2.mp4" type="video/mp4" />
      </video>

      <canvas ref={canvasRef} width="640" height="360" style={{ display: "none" }} />

      <button className="btn btn-primary mt-2" onClick={handleCheckVehicle}>
        Check Vehicle
      </button>
    </div>
  );
};

export default LiveFeed;
