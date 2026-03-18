"use client";

import { useState, useEffect, useCallback } from "react";
import type { LiffProfile } from "@/lib/liff";

type Props = { liffProfile: LiffProfile | null };

const TITLES: { level: number; name: string; xp: number }[] = [
  { level: 1, name: "ラボ見学生", xp: 0 },
  { level: 2, name: "実験助手", xp: 100 },
  { level: 3, name: "データ収集員", xp: 250 },
  { level: 4, name: "仮説メーカー", xp: 500 },
  { level: 5, name: "ラボ研修生", xp: 800 },
  { level: 6, name: "実験オペレーター", xp: 1200 },
  { level: 7, name: "分析アシスタント", xp: 1700 },
  { level: 8, name: "リサーチメイト", xp: 2400 },
  { level: 9, name: "論文リーダー", xp: 3200 },
  { level: 10, name: "ジュニアリサーチャー", xp: 4200 },
  { level: 11, name: "ラボ・テクニシャン", xp: 5500 },
  { level: 12, name: "フィールドワーカー", xp: 7000 },
  { level: 13, name: "シニアリサーチャー", xp: 9000 },
  { level: 14, name: "ラボリーダー", xp: 11500 },
  { level: 15, name: "主任研究員", xp: 14500 },
  { level: 16, name: "博士候補生", xp: 18000 },
  { level: 17, name: "准教授", xp: 22000 },
  { level: 18, name: "AI Debugger", xp: 27000 },
  { level: 19, name: "Associate Professor", xp: 33000 },
  { level: 20, name: "Professor", xp: 40000 },
];

const SUBJECT_COLORS: Record<string, string> = {
  "数学": "#E8553A", "英語": "#3A7CE8", "理科": "#2EAA5E",
  "社会": "#D4A020", "国語": "#9B59B6", "その他": "#7F8C8D",
};

function getTitleForXp(xp: number) {
  let t = TITLES[0];
  for (const title of TITLES) {
    if (xp >= title.xp) t = title;
    else break;
  }
  return t;
}

function getNextTitle(xp: number) {
  for (const title of TITLES) {
    if (xp < title.xp) return title;
  }
  return null;
}

type ReportData = {
  user: { name: string; xp: number; level: number; streak: number; grade?: string };
  totalMinutes: number;
  sessionsCount: number;
  weekData: { date: string; minutes: number }[];
  subjects: { subject: string; minutes: number }[];
  recent: { type: string; subject: string; minutes: number; xp: number; date: string }[];
};

export default function ReportScreen({ liffProfile }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTitles, setShowTitles] = useState(false);

  const userId = liffProfile?.userId ?? "guest";

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/report?userId=${encodeURIComponent(userId)}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="w-10 h-10 border-3 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
      </div>
    );
  }

  const { user, totalMinutes, sessionsCount, weekData, subjects, recent } = data;
  const currentTitle = getTitleForXp(user.xp);
  const nextTitle = getNextTitle(user.xp);
  const progressPct = nextTitle
    ? ((user.xp - currentTitle.xp) / (nextTitle.xp - currentTitle.xp)) * 100
    : 100;

  const maxWeekMin = Math.max(...weekData.map((d) => d.minutes), 1);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalRemainingMin = totalMinutes % 60;

  const maxSubjectMin = Math.max(...subjects.map((s) => s.minutes), 1);

  return (
    <div className="min-h-screen bg-[#FFFBF5] px-4 py-6 pb-20 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <p className="text-3xl mb-1">📊</p>
        <h1 className="text-lg font-bold text-[#2D2D2D]">レポート</h1>
      </div>

      {/* Level card */}
      <div className="bg-white border border-[#F0E6D6] rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-[#FFF3E0] flex items-center justify-center text-xl font-bold text-[#F97316]">
            {currentTitle.level}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#2D2D2D]">Lv.{currentTitle.level} {currentTitle.name}</p>
            <p className="text-xs text-[#8C7B6B]">{user.xp} XP</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-2.5 bg-[#F5F0EB] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#F97316] to-[#FBBF24] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          {nextTitle && (
            <p className="text-[10px] text-[#8C7B6B] mt-1 text-right">
              次: Lv.{nextTitle.level} {nextTitle.name}（{nextTitle.xp} XP）
            </p>
          )}
        </div>

        <button
          onClick={() => setShowTitles(!showTitles)}
          className="text-[11px] text-[#3A7CE8] font-semibold"
        >
          {showTitles ? "称号一覧を閉じる ▲" : "称号一覧を見る ▼"}
        </button>

        {showTitles && (
          <div className="mt-2 bg-[#FFFBF5] rounded-xl p-3 max-h-60 overflow-y-auto">
            {TITLES.map((t) => (
              <div
                key={t.level}
                className={`flex justify-between text-xs py-1 ${user.xp >= t.xp ? "text-[#2D2D2D]" : "text-[#BDB0A3]"}`}
              >
                <span>
                  {user.xp >= t.xp ? "✅" : "🔒"} Lv.{t.level} {t.name}
                </span>
                <span>{t.xp.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats 3 cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <StatCard emoji="🔥" value={`${user.streak}日`} label="連続" color="#F97316" />
        <StatCard emoji="⏱️" value={totalHours > 0 ? `${totalHours}h${totalRemainingMin}m` : `${totalMinutes}分`} label="累計" color="#3A7CE8" />
        <StatCard emoji="📝" value={`${sessionsCount}回`} label="セッション" color="#9B59B6" />
      </div>

      {/* Weekly chart */}
      <div className="bg-white border border-[#F0E6D6] rounded-2xl p-4 mb-4 shadow-sm">
        <p className="text-sm font-bold text-[#2D2D2D] mb-3">📅 過去7日間</p>
        <div className="flex items-end gap-1.5 h-28">
          {weekData.map((d) => {
            const pct = (d.minutes / maxWeekMin) * 100;
            const dayName = new Date(d.date + "T00:00:00").toLocaleDateString("ja-JP", { weekday: "short" });
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center">
                <p className="text-[9px] text-[#8C7B6B] mb-1">
                  {d.minutes > 0 ? `${d.minutes}m` : ""}
                </p>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(pct, 4)}%`,
                    backgroundColor: d.minutes > 0 ? "#F97316" : "#F0E6D6",
                    minHeight: "4px",
                  }}
                />
                <p className="text-[9px] text-[#8C7B6B] mt-1">{dayName}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subject breakdown */}
      {subjects.length > 0 && (
        <div className="bg-white border border-[#F0E6D6] rounded-2xl p-4 mb-4 shadow-sm">
          <p className="text-sm font-bold text-[#2D2D2D] mb-3">📚 科目別</p>
          <div className="space-y-2.5">
            {subjects.map((s) => {
              const color = SUBJECT_COLORS[s.subject] ?? "#7F8C8D";
              const pct = (s.minutes / maxSubjectMin) * 100;
              return (
                <div key={s.subject}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-semibold" style={{ color }}>{s.subject}</span>
                    <span className="text-[#8C7B6B]">
                      {s.minutes >= 60 ? `${Math.floor(s.minutes / 60)}h${s.minutes % 60}m` : `${s.minutes}分`}
                    </span>
                  </div>
                  <div className="h-2 bg-[#F5F0EB] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent logs */}
      {recent.length > 0 && (
        <div className="bg-white border border-[#F0E6D6] rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-[#2D2D2D] mb-3">🕐 最近の記録</p>
          <div className="space-y-2">
            {recent.map((r, i) => {
              const color = SUBJECT_COLORS[r.subject] ?? "#7F8C8D";
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[10px]"
                    style={{ backgroundColor: color }}
                  >
                    {r.subject.slice(0, 1)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#2D2D2D]">{r.subject} {r.minutes}分</p>
                    <p className="text-[#8C7B6B]">{r.date}</p>
                  </div>
                  <p className="text-[#F97316] font-bold">+{r.xp} XP</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, value, label, color }: { emoji: string; value: string; label: string; color: string }) {
  return (
    <div className="bg-white border border-[#F0E6D6] rounded-xl p-3 text-center shadow-sm">
      <p className="text-lg">{emoji}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#8C7B6B]">{label}</p>
    </div>
  );
}
