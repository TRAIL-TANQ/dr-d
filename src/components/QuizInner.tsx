"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { QuizQuestion, SessionResult } from "@/lib/types";

interface Props {
  tag: string;
  q: QuizQuestion;
  idx: number;
  total: number;
  reporterName?: string;
  onResult: (r: SessionResult) => void;
  onFinish: (action: "next" | "done") => void;
  finishLabel: string;
}

const REPORT_TYPES = [
  { value: "wrong_answer", label: "正解が違う" },
  { value: "bad_question", label: "問題文がおかしい" },
  { value: "duplicate_choices", label: "選択肢が重複" },
  { value: "other", label: "その他" },
] as const;

interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

const LETTERS = ["A", "B", "C"];
const MAX_TUTOR_TURNS = 3;

export default function QuizInner({
  tag,
  q,
  idx,
  total,
  reporterName,
  onResult,
  onFinish,
  finishLabel,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const explanationOpenRef = useRef(false);
  const resultSent = useRef(false);
  const isLast = idx === total - 1;

  // Tutor state
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorTurns, setTutorTurns] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<string>("");
  const [reportComment, setReportComment] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const answered = selected !== null;
  const isCorrect = answered && selected === q.answer;
  const isSkipped = answered && selected === -1;

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tutorMessages]);

  const handleNext = useCallback(() => {
    onFinish(isLast ? "done" : "next");
  }, [isLast, onFinish]);

  const handleSelect = useCallback(
    (choiceIdx: number) => {
      if (answered) return;
      setSelected(choiceIdx);

      const correct = choiceIdx === q.answer;
      const skipped = choiceIdx === -1;

      if (!resultSent.current) {
        resultSent.current = true;
        onResult({ selected: choiceIdx, correct, skipped });
      }

      // Auto-advance timer (skip if last question)
      if (!isLast) {
        const delay = correct ? 1000 : 1800;
        timerRef.current = setTimeout(() => {
          if (!explanationOpenRef.current && !tutorOpen) {
            handleNext();
          }
        }, delay);
      }
    },
    [answered, q.answer, isLast, onResult, handleNext, tutorOpen],
  );

  const toggleExplanation = () => {
    const next = !showExplanation;
    setShowExplanation(next);
    explanationOpenRef.current = next;
    if (next && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleHint = () => {
    if (!hintUsed) setHintUsed(true);
    setShowHint((v) => !v);
  };

  // --- Tutor ---
  const openTutor = () => {
    setTutorOpen(true);
    // Cancel auto-advance
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Send initial tutor request if no messages yet
    if (tutorMessages.length === 0) {
      sendTutorMessage(null);
    }
  };

  const sendTutorMessage = async (userMessage: string | null) => {
    if (tutorLoading) return;
    if (tutorTurns >= MAX_TUTOR_TURNS && userMessage) return;

    setTutorLoading(true);

    // Add user message to history
    const history = [...tutorMessages];
    if (userMessage) {
      const userMsg: TutorMessage = { role: "user", content: userMessage };
      history.push(userMsg);
      setTutorMessages((prev) => [...prev, userMsg]);
      setTutorInput("");
    }

    try {
      const studentAnswer =
        selected === -1
          ? "わからない"
          : q.choices[selected ?? 0] ?? "未回答";
      const correctAnswer = q.choices[q.answer] ?? "";

      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.q,
          studentAnswer,
          correctAnswer,
          conversationHistory: history,
        }),
      });

      if (!res.ok) throw new Error("tutor request failed");

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no reader");

      const decoder = new TextDecoder();
      let assistantText = "";

      // Add placeholder assistant message
      setTutorMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantText += parsed.text;
                // Update last assistant message
                setTutorMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                  };
                  return updated;
                });
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      if (userMessage) {
        setTutorTurns((t) => t + 1);
      }
    } catch (err) {
      console.error("tutor error:", err);
      setTutorMessages((prev) => [
        ...prev,
        { role: "assistant", content: "ごめんなさい、エラーが発生しました。解説を見てみてね。" },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  const handleTutorSubmit = () => {
    const msg = tutorInput.trim();
    if (!msg || tutorLoading) return;
    sendTutorMessage(msg);
  };

  // --- Report ---
  const handleReport = async () => {
    if (!reportType || reportSending || !q.id) return;
    setReportSending(true);
    try {
      const res = await fetch("/api/quiz/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: q.id,
          reporter_name: reporterName || "ゲスト",
          report_type: reportType,
          comment: reportComment.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok || data.duplicate) {
        setReportDone(true);
        setTimeout(() => setReportOpen(false), 2000);
      }
    } catch { /* ignore */ }
    finally { setReportSending(false); }
  };

  // Need manual "next" button?
  const showNextBtn = answered && (showExplanation || isLast || tutorOpen);

  // Choice button style
  function choiceClass(i: number) {
    const base =
      "w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left font-medium transition-all duration-200";
    if (!answered) {
      return `${base} bg-drd-bg2 border border-[#E8DDD0] hover:border-drd-amber/60 hover:bg-drd-bg3 cursor-pointer`;
    }
    if (i === q.answer) {
      return `${base} bg-drd-teal/15 border-2 border-drd-teal`;
    }
    if (i === selected && i !== q.answer) {
      return `${base} bg-drd-coral/15 border-2 border-drd-coral`;
    }
    return `${base} bg-drd-bg2 border border-[#E8DDD0] opacity-40`;
  }

  function letterBadgeClass(i: number) {
    const base = "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0";
    if (!answered) return `${base} bg-[#E8DDD0] text-[#8C7B6B]`;
    if (i === q.answer) return `${base} bg-drd-teal text-white`;
    if (i === selected && i !== q.answer) return `${base} bg-drd-coral text-white`;
    return `${base} bg-[#E8DDD0] text-[#8C7B6B] opacity-40`;
  }

  // Card glow animation
  const cardAnim = answered
    ? isCorrect
      ? "animate-glow-green"
      : "animate-flash-red"
    : "";

  return (
    <div
      className={`animate-fade-in rounded-2xl bg-drd-bg2 border border-[#E8DDD0] p-5 sm:p-6 max-w-lg mx-auto ${cardAnim}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-[#8C7B6B]">{tag}</span>
        <span className="text-sm font-bold text-drd-amber">
          {idx + 1}
          <span className="text-[#8C7B6B]"> / {total}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[#E8DDD0] mb-5">
        <div
          className="h-full rounded-full bg-drd-amber transition-all duration-500"
          style={{ width: `${((idx + (answered ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-base sm:text-lg font-bold mb-5 leading-relaxed">{q.q}</p>

      {/* Choices */}
      <div className="flex flex-col gap-2.5 mb-4">
        {q.choices.map((c, i) => (
          <button
            key={i}
            className={choiceClass(i)}
            onClick={() => handleSelect(i)}
            disabled={answered}
          >
            <span className={letterBadgeClass(i)}>
              {answered && i === q.answer
                ? "✓"
                : answered && i === selected && i !== q.answer
                  ? "✗"
                  : LETTERS[i]}
            </span>
            <span className="text-sm sm:text-base">{c}</span>
          </button>
        ))}

        {/* Skip button */}
        <button
          className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
            answered
              ? selected === -1
                ? "bg-drd-coral/15 border-2 border-drd-coral"
                : "bg-drd-bg2 border border-[#E8DDD0] opacity-40"
              : "bg-transparent border border-dashed border-[#E8DDD0] text-[#8C7B6B] hover:border-[#8C7B6B] cursor-pointer"
          }`}
          onClick={() => handleSelect(-1)}
          disabled={answered}
        >
          🤔 わからない
        </button>
      </div>

      {/* Hint button (before answer) */}
      {!answered && (
        <div className="flex justify-end mb-2">
          <button
            className="text-sm text-drd-amber/80 hover:text-drd-amber transition-colors"
            onClick={toggleHint}
          >
            💡 ヒント
          </button>
        </div>
      )}

      {/* Hint content */}
      {showHint && (
        <div className="animate-fade-in bg-drd-amber/10 border border-drd-amber/30 rounded-xl px-4 py-3 mb-3 text-sm text-drd-amber">
          💡 {q.hint}
        </div>
      )}

      {/* After answer: feedback + explanation toggle + tutor */}
      {answered && (
        <div className="mt-3 space-y-3">
          {/* Result badge */}
          <div
            className={`text-center text-sm font-bold py-2 rounded-lg ${
              isCorrect
                ? "bg-drd-teal/15 text-drd-teal"
                : "bg-drd-coral/15 text-drd-coral"
            }`}
          >
            {isCorrect ? "✨ 正解！" : isSkipped ? "⏭ スキップ" : "😥 不正解…"}
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            <button
              className="flex-1 text-sm text-center py-2 rounded-lg text-drd-purple-light hover:bg-drd-purple/10 transition-colors"
              onClick={toggleExplanation}
            >
              📖 {showExplanation ? "解説をとじる" : "解説を見る"}
            </button>

            {/* Tutor button - only show on incorrect/skipped */}
            {!isCorrect && !tutorOpen && (
              <button
                className="flex-1 text-sm text-center py-2 rounded-lg text-drd-teal hover:bg-drd-teal/10 transition-colors"
                onClick={openTutor}
              >
                🧠 一緒に考える
              </button>
            )}
          </div>

          {showExplanation && (
            <div className="animate-fade-in bg-drd-purple/10 border border-drd-purple/30 rounded-xl px-4 py-3 text-sm leading-relaxed text-[#5D4E3C]">
              {q.explanation}
            </div>
          )}

          {/* Tutor Chat UI */}
          {tutorOpen && (
            <div className="animate-fade-in border border-drd-teal/30 rounded-xl overflow-hidden">
              {/* Chat header */}
              <div className="bg-drd-teal/10 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧬</span>
                  <span className="text-sm font-bold text-drd-teal">Dr.D と一緒に考えよう</span>
                </div>
                <span className="text-xs text-[#8C7B6B]">
                  {tutorTurns}/{MAX_TUTOR_TURNS}回
                </span>
              </div>

              {/* Chat messages */}
              <div className="max-h-60 overflow-y-auto px-4 py-3 space-y-3 bg-drd-bg/50">
                {tutorMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <span className="text-lg shrink-0 mt-0.5">🧬</span>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-drd-amber/15 text-[#333] rounded-br-none"
                          : "bg-drd-bg2 border border-[#E8DDD0] text-[#5D4E3C] rounded-bl-none"
                      }`}
                    >
                      {msg.content || (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-[#BDB0A3] rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-[#BDB0A3] rounded-full animate-bounce [animation-delay:0.15s]" />
                          <span className="w-1.5 h-1.5 bg-[#BDB0A3] rounded-full animate-bounce [animation-delay:0.3s]" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              {tutorTurns < MAX_TUTOR_TURNS ? (
                <div className="flex gap-2 px-3 py-2 border-t border-[#E8DDD0] bg-drd-bg2">
                  <input
                    className="flex-1 bg-drd-bg border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm outline-none focus:border-drd-teal transition-colors placeholder:text-[#BDB0A3]"
                    value={tutorInput}
                    onChange={(e) => setTutorInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleTutorSubmit(); }}
                    placeholder="考えたことを入力してね..."
                    disabled={tutorLoading}
                  />
                  <button
                    className="bg-drd-teal hover:bg-drd-teal/80 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
                    onClick={handleTutorSubmit}
                    disabled={!tutorInput.trim() || tutorLoading}
                  >
                    送信
                  </button>
                </div>
              ) : (
                <div className="px-4 py-3 border-t border-[#E8DDD0] bg-drd-bg2 text-center">
                  <p className="text-xs text-[#8C7B6B] mb-2">
                    会話の上限に達しました。解説を確認してみよう！
                  </p>
                  {!showExplanation && (
                    <button
                      className="text-sm text-drd-purple-light hover:text-white transition-colors"
                      onClick={toggleExplanation}
                    >
                      📖 解説を見る
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Report link */}
          {q.id && !reportOpen && !reportDone && (
            <button
              className="text-xs text-[#BDB0A3] hover:text-drd-coral transition-colors"
              onClick={() => { setReportOpen(true); if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } }}
            >
              🚩 この問題おかしい？
            </button>
          )}
          {reportDone && (
            <div className="text-xs text-drd-teal text-center py-1">
              ありがとう！確認後にXPがもらえるよ 🎁
            </div>
          )}

          {/* Report modal */}
          {reportOpen && !reportDone && (
            <div className="animate-fade-in bg-white border border-[#E8DDD0] rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-bold">🚩 問題を報告</h4>
              <div className="flex flex-col gap-1.5">
                {REPORT_TYPES.map((rt) => (
                  <label key={rt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="reportType"
                      value={rt.value}
                      checked={reportType === rt.value}
                      onChange={() => setReportType(rt.value)}
                      className="accent-drd-amber"
                    />
                    {rt.label}
                  </label>
                ))}
              </div>
              <input
                className="w-full bg-drd-bg border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm outline-none focus:border-drd-amber transition-colors placeholder:text-[#BDB0A3]"
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                placeholder="詳細（任意）"
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 bg-drd-amber hover:bg-drd-amber/90 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                  onClick={handleReport}
                  disabled={!reportType || reportSending}
                >
                  {reportSending ? "送信中..." : "報告する"}
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-sm text-[#8C7B6B] hover:bg-drd-bg3 transition-colors"
                  onClick={() => setReportOpen(false)}
                >
                  やめる
                </button>
              </div>
            </div>
          )}

          {/* Next button */}
          {showNextBtn && (
            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 text-white font-bold py-3 rounded-xl transition-colors"
              onClick={handleNext}
            >
              {isLast ? finishLabel : "つぎへ →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
