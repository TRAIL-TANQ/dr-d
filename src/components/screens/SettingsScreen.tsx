"use client";

import { useState, useEffect, useCallback } from "react";
import type { LiffProfile } from "@/lib/liff";

type Props = { liffProfile: LiffProfile | null };

const GRADES = ["中1", "中2", "中3", "高1", "高2", "高3"];

const MENU_ITEMS = [
  { icon: "👤", label: "プロフィール編集", key: "profile" },
  { icon: "📚", label: "教科書設定", key: "textbook" },
  { icon: "🔔", label: "通知", key: "notification" },
  { icon: "💳", label: "お支払い方法", key: "payment" },
  { icon: "📄", label: "利用規約", key: "terms" },
  { icon: "❓", label: "ヘルプ・お問い合わせ", key: "help" },
];

type UserData = {
  name: string;
  grade: string;
  school: string;
  xp: number;
  level: number;
  trial_start_date: string | null;
  trial_end_date: string | null;
  plan_status: string | null;
};

export default function SettingsScreen({ liffProfile }: Props) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [saving, setSaving] = useState(false);

  const userId = liffProfile?.userId ?? "guest";

  const fetchUser = useCallback(async () => {
    const res = await fetch(`/api/settings?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      setEditName(data.user.name ?? "");
      setEditGrade(data.user.grade ?? "");
      setEditSchool(data.user.school ?? "");
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_profile",
        userId,
        name: editName,
        grade: editGrade,
        school: editSchool,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setUser((u) => u ? { ...u, name: editName, grade: editGrade, school: editSchool } : u);
      setModal(null);
      showToast("保存しました！");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="w-10 h-10 border-3 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] px-4 py-6 pb-20 max-w-lg mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-white border border-[#F0E6D6] shadow-lg rounded-2xl px-5 py-2.5 text-sm font-semibold text-[#2D2D2D] animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-5">
        <p className="text-3xl mb-1">⚙️</p>
        <h1 className="text-lg font-bold text-[#2D2D2D]">設定</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-[#F0E6D6] rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          {liffProfile?.pictureUrl ? (
            <img
              src={liffProfile.pictureUrl}
              alt="icon"
              className="w-14 h-14 rounded-full border-2 border-[#F0E6D6]"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#F5F0EB] flex items-center justify-center text-2xl">
              👤
            </div>
          )}
          <div className="flex-1">
            <p className="font-bold text-[#2D2D2D]">{user?.name ?? "ゲスト"}</p>
            <p className="text-xs text-[#8C7B6B]">
              {user?.school ? `${user.school} ` : ""}{user?.grade ?? ""}
            </p>
            <p className="text-xs text-[#F97316] font-semibold mt-0.5">
              Lv.{user?.level ?? 1} ・ {user?.xp ?? 0} XP
            </p>
          </div>
        </div>
      </div>

      {/* Plan section */}
      <PlanSection user={user} />

      {/* Menu list */}
      <div className="bg-white border border-[#F0E6D6] rounded-2xl overflow-hidden shadow-sm">
        {MENU_ITEMS.map((item, i) => (
          <button
            key={item.key}
            onClick={() => setModal(item.key)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm hover:bg-[#FFFBF5] transition-colors ${
              i < MENU_ITEMS.length - 1 ? "border-b border-[#F5F0EB]" : ""
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="flex-1 font-medium text-[#2D2D2D]">{item.label}</span>
            <span className="text-[#BDB0A3]">›</span>
          </button>
        ))}
      </div>

      {/* Profile edit modal */}
      {modal === "profile" && (
        <BottomSheet onClose={() => setModal(null)}>
          <h2 className="text-base font-bold text-[#2D2D2D] mb-4">👤 プロフィール編集</h2>

          <label className="block text-xs text-[#8C7B6B] mb-1">名前</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-[#FFFBF5] border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-sm mb-3 outline-none focus:border-[#F97316] transition-colors"
            placeholder="なまえ"
          />

          <label className="block text-xs text-[#8C7B6B] mb-1">学年</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setEditGrade(g)}
                className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  backgroundColor: editGrade === g ? "#F97316" : "#F5F0EB",
                  color: editGrade === g ? "#FFF" : "#6B6B6B",
                }}
              >
                {g}
              </button>
            ))}
          </div>

          <label className="block text-xs text-[#8C7B6B] mb-1">学校</label>
          <input
            value={editSchool}
            onChange={(e) => setEditSchool(e.target.value)}
            className="w-full bg-[#FFFBF5] border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-sm mb-4 outline-none focus:border-[#F97316] transition-colors"
            placeholder="学校名"
          />

          <button
            onClick={handleSaveProfile}
            disabled={saving || !editName.trim()}
            className="w-full bg-[#F97316] hover:bg-[#EA6A0C] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </BottomSheet>
      )}

      {/* Other modals (UI only) */}
      {modal && modal !== "profile" && (
        <BottomSheet onClose={() => setModal(null)}>
          <div className="text-center py-6">
            <p className="text-4xl mb-3">
              {MENU_ITEMS.find((m) => m.key === modal)?.icon ?? "📋"}
            </p>
            <p className="text-sm font-bold text-[#2D2D2D] mb-1">
              {MENU_ITEMS.find((m) => m.key === modal)?.label}
            </p>
            <p className="text-xs text-[#8C7B6B]">準備中です</p>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function PlanSection({ user }: { user: UserData | null }) {
  const planStatus = user?.plan_status ?? "trial";
  const trialStart = user?.trial_start_date;
  const trialEnd = user?.trial_end_date;

  if (planStatus === "trial" && trialEnd) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(trialEnd + "T00:00:00");
    const startDate = trialStart ? new Date(trialStart + "T00:00:00") : new Date(endDate.getTime() - 14 * 86400000);
    const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000));
    const elapsed = totalDays - daysLeft;
    const pct = Math.min(100, (elapsed / totalDays) * 100);
    const expired = daysLeft <= 0;

    if (expired) {
      return (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 mb-4">
          <p className="text-sm font-bold text-[#DC2626] mb-1">おためし期間が終了しました</p>
          <p className="text-xs text-[#991B1B] mb-3">プランを選んで学習を続けよう！</p>
          <div className="bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] border border-[#FBBF24]/30 rounded-xl p-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-[#92400E]">マンスリープラン</p>
                <p className="text-[10px] text-[#A16207]">月額・いつでも解約OK</p>
              </div>
              <p className="text-lg font-bold text-[#92400E]">¥9,800</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Trial banner */}
        <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-2xl p-4 mb-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-[#166534]">🎁 2週間無料おためし中！</p>
            <p className="text-sm font-bold text-[#166534]">あと{daysLeft}日</p>
          </div>
          <div className="h-2 bg-[#DCFCE7] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4ADE80] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-[#15803D] mt-1.5">{elapsed}日経過 / {totalDays}日間</p>
        </div>

        {/* Plan card */}
        <div className="bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] border border-[#FBBF24]/30 rounded-2xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-sm font-bold text-[#92400E]">おためし → マンスリー</p>
              <p className="text-[10px] text-[#A16207]">おためし終了後に自動でマンスリーに移行</p>
            </div>
            <p className="text-lg font-bold text-[#92400E]">¥9,800<span className="text-xs font-normal">/月</span></p>
          </div>
        </div>
      </>
    );
  }

  // Active plan
  return (
    <div className="bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] border border-[#FBBF24]/30 rounded-2xl p-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-bold text-[#92400E]">マンスリープラン</p>
          <p className="text-xs text-[#A16207]">次回更新: 2026/04/01</p>
        </div>
        <p className="text-lg font-bold text-[#92400E]">¥9,800</p>
      </div>
    </div>
  );
}

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
