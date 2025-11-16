import React, { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function InternetSpeedMonitor({
   testUrl="https://speed.cloudflare.com/__down?bytes=5000000",
  intervalMs= 8000,
  sampleDurationMs=4000,
  maxPoints = 60,
}) {
  const [running, setRunning] = useState(true);
  const [data, setData] = useState([]);
  const runningRef = useRef(running);
  const timerRef = useRef(null);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    measureAndPush();
    timerRef.current = setInterval(() => {
      if (runningRef.current) measureAndPush();
    }, intervalMs);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testUrl, intervalMs, sampleDurationMs]);

  async function measureSpeed() {
    const controller = new AbortController();
    let bytes = 0;

    try {
      const response = await fetch(testUrl, {
        cache: "no-cache",
        mode: "cors",
        signal: controller.signal,
      });

      if (response.body && response.body.getReader) {
        const reader = response.body.getReader();
        const startTime = performance.now();
        const stopAt = startTime + sampleDurationMs;

        while (true) {
          const now = performance.now();
          if (now >= stopAt) {
            controller.abort();
            break;
          }
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value ? value.length : 0;
        }

        const end = performance.now();
        const seconds = Math.max(0.001, (end - startTime) / 1000);
        const mbps = (bytes * 8) / (seconds * 1_000_000);
        return mbps;
      }

      const t0 = performance.now();
      const blob = await response.blob();
      const t1 = performance.now();
      const seconds = (t1 - t0) / 1000;
      const mbps = (blob.size * 8) / (seconds * 1_000_000);
      return mbps;
    } catch {
      return null;
    }
  }

  async function measureAndPush() {
    const mbps = await measureSpeed();
    const now = new Date();
    setData((prev) => {
      const next = [
        ...prev,
        { time: now.toLocaleTimeString(), mbps: mbps ? mbps.toFixed(2) : 0 },
      ];
      if (next.length > maxPoints) next.shift();
      return next;
    });
  }

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center" }}>Internet Speed Monitor</h2>
      <button
        onClick={() => setRunning(!running)}
        style={{
          margin: "10px 0",
          padding: "8px 16px",
          backgroundColor: running ? "#e74c3c" : "#2ecc71",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        {running ? "Pause" : "Start"}
      </button>

      <div style={{ height: "320px", background: "white" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" minTickGap={20} />
            <YAxis
              domain={[0, "dataMax + 5"]}
              label={{
                value: "Mbps",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="mbps"
              stroke="#007BFF"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: "20px", textAlign: "center" }}>
        {data.length > 0 && (
          <>
            <p>
              <strong>Latest Speed:</strong> {data[data.length - 1].mbps} Mbps
            </p>
            <p>
              <strong>Average Speed:</strong>{" "}
              {(
                data.reduce((sum, p) => sum + parseFloat(p.mbps), 0) /
                data.length
              ).toFixed(2)}{" "}
              Mbps
            </p>
          </>
        )}
      </div>
    </div>
  );
}
