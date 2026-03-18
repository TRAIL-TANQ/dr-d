"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { LiffProfile } from "@/lib/liff";

type Props = { liffProfile: LiffProfile | null };

type Stats = {
  streak: number;
  monthlyVisits: number;
  totalMinutes: number;
  xp: number;
  level: number;
};

export default function CheckinScreen({ liffProfile }: Props) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [checkoutMinutes, setCheckoutMinutes] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guest fallback ID
  const userId = liffProfile?.userId ?? "guest_" + (typeof window !== "undefined" ? window.navigator.userAgent.slice(-8) : "000");
  const userName = liffProfile?.displayName ?? "ゲスト";

  const api = useCallback(async (action: string) => {
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, line_user_id: userId, name: userName }),
    });
    return res.json();
  }, [userId, userName]);

  // Load status + stats on mount
  useEffect(() => {
    (async () => {
      const [statusRes, statsRes] = await Promise.all([api("status"), api("stats")]);
      if (statusRes.checkedIn && statusRes.checkIn) {
        setCheckedIn(true);
        setCheckInTime(statusRes.checkIn.checked_in_at);
      }
      if (statsRes) setStats(statsRes);
      setLoading(false);
    })();
  }, [api]);

  // Elapsed timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!checkedIn || !checkInTime) return;

    const update = () => {
      const diff = Date.now() - new Date(checkInTime).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(h > 0 ? `${h}時間${m}分${s}秒` : `${m}分${s}秒`);
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [checkedIn, checkInTime]);

  const handleCheckin = async () => {
    setActionLoading(true);
    const res = await api("checkin");
    if (res.success) {
      setCheckedIn(true);
      setCheckInTime(new Date().toISOString());
      setStats((s) => s ? { ...s, streak: res.streak, xp: res.xp, level: res.level } : s);
      showToast(`入室できたよ！+${res.earnedXp} XP 🎉`);
    } else if (res.alreadyCheckedIn) {
      showToast("すでに入室中です");
    }
    setActionLoading(false);
  };

  const handleCheckout = async () => {
    setActionLoading(true);
    const res = await api("checkout");
    if (res.success) {
      setCheckedIn(false);
      setCheckInTime(null);
      setCheckoutMinutes(res.minutes);
      showToast(`おつかれさま！${res.minutes}分がんばったね ✨`);
      // Refresh stats
      const statsRes = await api("stats");
      if (statsRes) setStats(statsRes);
    }
    setActionLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="w-10 h-10 border-3 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex flex-col items-center px-5 py-8 font-[var(--font-noto-sans-jp)]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-[#F0E6D6] shadow-lg rounded-2xl px-6 py-3 text-sm font-semibold text-[#2D2D2D] animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-3xl mb-2">🏠</p>
        <h1 className="text-xl font-bold text-[#2D2D2D]">
          {userName}さん、{checkedIn ? "がんばってるね！" : "こんにちは！"}
        </h1>
        {stats && (
          <p className="text-xs text-[#8C7B6B] mt-1">
            Lv.{stats.level} ・ {stats.xp} XP
          </p>
        )}
      </div>

      {/* Main Action */}
      {!checkedIn ? (
        <button
          onClick={handleCheckin}
          disabled={actionLoading}
          className="w-full max-w-sm bg-[#F97316] hover:bg-[#EA6A0C] disabled:opacity-60 text-white font-bold text-lg py-5 rounded-2xl shadow-md transition-all active:scale-[0.98] mb-8"
        >
          {actionLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              処理中...
            </span>
          ) : (
            "🚪 入室する"
          )}
        </button>
      ) : (
        <div className="w-full max-w-sm bg-white border-2 border-[#F97316]/20 rounded-2xl p-6 text-center mb-8 shadow-sm">
          <p className="text-xs text-[#8C7B6B] mb-1">入室中</p>
          <p className="text-3xl font-bold text-[#F97316] font-[var(--font-quicksand)] tracking-wider mb-4">
            {elapsed}
          </p>
          <button
            onClick={handleCheckout}
            disabled={actionLoading}
            className="w-full bg-[#E8E0D8] hover:bg-[#DDD5CC] disabled:opacity-60 text-[#6B6B6B] font-bold py-3.5 rounded-xl transition-all text-sm"
          >
            {actionLoading ? "処理中..." : "退室する"}
          </button>
        </div>
      )}

      {/* Checkout summary */}
      {checkoutMinutes !== null && !checkedIn && (
        <div className="w-full max-w-sm bg-[#3A7CE8]/5 border border-[#3A7CE8]/20 rounded-2xl p-5 text-center mb-6 animate-fade-in">
          <p className="text-sm text-[#3A7CE8] font-semibold">
            今日は <span className="text-xl font-bold">{checkoutMinutes}分</span> がんばりました！
          </p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="w-full max-w-sm grid grid-cols-3 gap-3 mb-6">
          <StatCard emoji="🔥" label="連続日数" value={`${stats.streak}日`} color="#F97316" />
          <StatCard emoji="📅" label="今月の来室" value={`${stats.monthlyVisits}回`} color="#3A7CE8" />
          <StatCard
            emoji="⏱️"
            label="累計学習"
            value={stats.totalMinutes >= 60
              ? `${Math.floor(stats.totalMinutes / 60)}h${stats.totalMinutes % 60}m`
              : `${stats.totalMinutes}分`}
            color="#8B5CF6"
          />
        </div>
      )}

      {/* Streak badge */}
      {stats && stats.streak >= 3 && (
        <div className="w-full max-w-sm bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] border border-[#FBBF24]/30 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-[#92400E]">
            🔥 {stats.streak}日連続！{stats.streak >= 7 ? "すごい！" : "この調子！"}
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, label, value, color }: { emoji: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-[#F0E6D6] rounded-xl p-3 text-center shadow-sm">
      <p className="text-xl mb-1">{emoji}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#8C7B6B]">{label}</p>
    </div>
  );
}
