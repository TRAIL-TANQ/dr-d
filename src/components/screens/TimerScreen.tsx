"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { LiffProfile } from "@/lib/liff";

type Props = { liffProfile: LiffProfile | null };

const SUBJECTS = [
  { key: "数学", icon: "∑", color: "#E8553A" },
  { key: "英語", icon: "A", color: "#3A7CE8" },
  { key: "理科", icon: "⚛", color: "#2EAA5E" },
  { key: "社会", icon: "🌏", color: "#D4A020" },
  { key: "国語", icon: "あ", color: "#9B59B6" },
  { key: "その他", icon: "+", color: "#7F8C8D" },
] as const;

const PRESETS = [15, 25, 45, 60] as const;

type TimerState = "idle" | "running" | "paused" | "done";

export default function TimerScreen({ liffProfile }: Props) {
  const [subject, setSubject] = useState<string>("数学");
  const [preset, setPreset] = useState<number>(25);
  const [remaining, setRemaining] = useState(25 * 60); // seconds
  const [state, setState] = useState<TimerState>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);

  const userId = liffProfile?.userId ?? "guest";
  const totalSeconds = preset * 60;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const tick = useCallback(() => {
    const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
    setRemaining(left);
    if (left <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setState("done");
    }
  }, []);

  const handleStart = () => {
    endTimeRef.current = Date.now() + remaining * 1000;
    intervalRef.current = setInterval(tick, 250);
    setState("running");
  };

  const handlePause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setState("paused");
  };

  const handleResume = () => {
    endTimeRef.current = Date.now() + remaining * 1000;
    intervalRef.current = setInterval(tick, 250);
    setState("running");
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRemaining(preset * 60);
    setState("idle");
  };

  const handlePreset = (m: number) => {
    if (state === "running") return;
    setPreset(m);
    setRemaining(m * 60);
    setState("idle");
  };

  const handleComplete = async () => {
    const minutes = preset - Math.ceil(remaining / 60);
    const actualMinutes = Math.max(minutes, preset); // completed full session
    setSending(true);
    try {
      const res = await fetch("/api/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", userId, subject, minutes: actualMinutes }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${actualMinutes}分完了！+${data.earnedXp} XP 🎉`);
      }
    } catch { /* ignore */ }
    setSending(false);
    handleReset();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // SVG circle progress
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const progress = state === "idle" ? 1 : remaining / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const subjectColor = SUBJECTS.find((s) => s.key === subject)?.color ?? "#F97316";

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex flex-col items-center px-5 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-[#F0E6D6] shadow-lg rounded-2xl px-6 py-3 text-sm font-semibold text-[#2D2D2D] animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-3xl mb-1">⏱️</p>
        <h1 className="text-lg font-bold text-[#2D2D2D]">学習タイマー</h1>
      </div>

      {/* Subject chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-sm">
        {SUBJECTS.map((s) => (
          <button
            key={s.key}
            onClick={() => state !== "running" && setSubject(s.key)}
            className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              backgroundColor: subject === s.key ? s.color : "#F5F0EB",
              color: subject === s.key ? "#FFF" : s.color,
              border: `1.5px solid ${subject === s.key ? s.color : "transparent"}`,
              opacity: state === "running" ? 0.6 : 1,
            }}
          >
            {s.icon} {s.key}
          </button>
        ))}
      </div>

      {/* Preset chips */}
      <div className="flex gap-2 mb-8">
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => handlePreset(m)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              backgroundColor: preset === m ? "#F97316" : "#FFF",
              color: preset === m ? "#FFF" : "#8C7B6B",
              border: `1.5px solid ${preset === m ? "#F97316" : "#E8DDD0"}`,
              opacity: state === "running" ? 0.5 : 1,
            }}
          >
            {m}分
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div className="relative w-64 h-64 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
          {/* Background circle */}
          <circle
            cx="130" cy="130" r={radius}
            fill="none" stroke="#F0E6D6" strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx="130" cy="130" r={radius}
            fill="none"
            stroke={state === "done" ? "#4CAF50" : subjectColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        {/* Time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {state === "done" ? (
            <>
              <p className="text-4xl mb-1">✅</p>
              <p className="text-sm font-semibold text-[#4CAF50]">完了！</p>
            </>
          ) : (
            <>
              <p
                className="text-5xl font-bold tracking-wider"
                style={{ fontVariantNumeric: "tabular-nums", color: subjectColor }}
              >
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </p>
              <p className="text-xs text-[#8C7B6B] mt-1">
                {state === "running" ? "集中中..." : state === "paused" ? "一時停止" : `${preset}分に設定`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 w-full max-w-xs">
        {state === "idle" && (
          <button
            onClick={handleStart}
            className="flex-1 bg-[#F97316] hover:bg-[#EA6A0C] text-white font-bold py-3.5 rounded-xl transition-all text-base active:scale-[0.98]"
          >
            ▶ スタート
          </button>
        )}

        {state === "running" && (
          <>
            <button
              onClick={handlePause}
              className="flex-1 bg-white border-2 border-[#E8DDD0] text-[#6B6B6B] font-bold py-3.5 rounded-xl transition-all text-sm"
            >
              ⏸ 一時停止
            </button>
            <button
              onClick={handleReset}
              className="px-5 bg-white border-2 border-[#E8DDD0] text-[#8C7B6B] font-bold py-3.5 rounded-xl transition-all text-sm"
            >
              ↩
            </button>
          </>
        )}

        {state === "paused" && (
          <>
            <button
              onClick={handleResume}
              className="flex-1 bg-[#F97316] hover:bg-[#EA6A0C] text-white font-bold py-3.5 rounded-xl transition-all text-sm"
            >
              ▶ 再開
            </button>
            <button
              onClick={handleReset}
              className="px-5 bg-white border-2 border-[#E8DDD0] text-[#8C7B6B] font-bold py-3.5 rounded-xl transition-all text-sm"
            >
              ↩ リセット
            </button>
          </>
        )}

        {state === "done" && (
          <button
            onClick={handleComplete}
            disabled={sending}
            className="flex-1 bg-[#4CAF50] hover:bg-[#43A047] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all text-base"
          >
            {sending ? "記録中..." : `${preset}分を記録する 📝`}
          </button>
        )}
      </div>
    </div>
  );
}
