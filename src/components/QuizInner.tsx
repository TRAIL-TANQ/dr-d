"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { QuizQuestion, SessionResult } from "@/lib/types";

interface Props {
  tag: string;
  q: QuizQuestion;
  idx: number;
  total: number;
  onResult: (r: SessionResult) => void;
  onFinish: (action: "next" | "done") => void;
  finishLabel: string;
}

const LETTERS = ["A", "B", "C"];

export default function QuizInner({
  tag,
  q,
  idx,
  total,
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

  const answered = selected !== null;
  const isCorrect = answered && selected === q.answer;
  const isSkipped = answered && selected === -1;

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
          if (!explanationOpenRef.current) {
            handleNext();
          }
        }, delay);
      }
    },
    [answered, q.answer, isLast, onResult, handleNext],
  );

  const toggleExplanation = () => {
    const next = !showExplanation;
    setShowExplanation(next);
    explanationOpenRef.current = next;
    // Cancel auto-advance when explanation is opened
    if (next && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleHint = () => {
    if (!hintUsed) setHintUsed(true);
    setShowHint((v) => !v);
  };

  // Need manual "next" button?
  const showNextBtn = answered && (showExplanation || isLast);

  // Choice button style
  function choiceClass(i: number) {
    const base =
      "w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left font-medium transition-all duration-200";
    if (!answered) {
      return `${base} bg-drd-bg2 border border-[#30363d] hover:border-drd-amber/60 hover:bg-drd-bg3 cursor-pointer`;
    }
    if (i === q.answer) {
      return `${base} bg-drd-teal/15 border-2 border-drd-teal`;
    }
    if (i === selected && i !== q.answer) {
      return `${base} bg-drd-coral/15 border-2 border-drd-coral`;
    }
    return `${base} bg-drd-bg2 border border-[#30363d] opacity-40`;
  }

  function letterBadgeClass(i: number) {
    const base = "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0";
    if (!answered) return `${base} bg-[#30363d] text-[#8b949e]`;
    if (i === q.answer) return `${base} bg-drd-teal text-white`;
    if (i === selected && i !== q.answer) return `${base} bg-drd-coral text-white`;
    return `${base} bg-[#30363d] text-[#8b949e] opacity-40`;
  }

  // Card glow animation
  const cardAnim = answered
    ? isCorrect
      ? "animate-glow-green"
      : "animate-flash-red"
    : "";

  return (
    <div
      className={`animate-fade-in rounded-2xl bg-drd-bg2 border border-[#30363d] p-5 sm:p-6 max-w-lg mx-auto ${cardAnim}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-[#8b949e]">{tag}</span>
        <span className="text-sm font-bold text-drd-amber">
          {idx + 1}
          <span className="text-[#8b949e]"> / {total}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[#30363d] mb-5">
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
                : "bg-drd-bg2 border border-[#30363d] opacity-40"
              : "bg-transparent border border-dashed border-[#30363d] text-[#8b949e] hover:border-[#8b949e] cursor-pointer"
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

      {/* After answer: feedback + explanation toggle */}
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

          {/* Explanation toggle */}
          <button
            className="w-full text-sm text-center text-drd-purple-light hover:text-white transition-colors"
            onClick={toggleExplanation}
          >
            📖 {showExplanation ? "解説をとじる" : "解説を見る"}
          </button>

          {showExplanation && (
            <div className="animate-fade-in bg-drd-purple/10 border border-drd-purple/30 rounded-xl px-4 py-3 text-sm leading-relaxed text-[#c9d1d9]">
              {q.explanation}
            </div>
          )}

          {/* Next button */}
          {showNextBtn && (
            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 text-drd-bg font-bold py-3 rounded-xl transition-colors"
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
