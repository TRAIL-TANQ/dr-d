"use client";

import type { HistoryEntry } from "@/lib/types";

interface Props {
  history: HistoryEntry[];
  onClose: () => void;
}

export default function HistoryPanel({ history, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white border-l border-[#E8DDD0] p-5 overflow-y-auto animate-fade-in shadow-xl">
        <h3 className="text-lg font-bold mb-5">📊 学習きろく</h3>

        {history.length === 0 ? (
          <p className="text-[#8C7B6B] text-sm">まだ記録がありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {history.slice(0, 10).map((h, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 bg-drd-bg border border-[#E8DDD0] rounded-xl px-4 py-3 text-sm"
              >
                <span className="text-[#8C7B6B] text-xs">
                  {new Date(h.date).toLocaleDateString("ja-JP")}
                </span>
                <span className="text-[#5D4E3C] truncate">{h.topic}</span>
                <span className="text-drd-teal font-semibold">
                  {h.quizScore}/10
                </span>
                <span className="text-drd-amber font-semibold text-xs">
                  +{h.xpEarned}XP
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          className="mt-6 w-full text-center text-sm text-[#8C7B6B] hover:text-[#333] border border-[#E8DDD0] rounded-xl py-2.5 transition-colors"
          onClick={onClose}
        >
          とじる
        </button>
      </div>
    </div>
  );
}
