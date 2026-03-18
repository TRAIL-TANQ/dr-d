"use client";

import { useState, useEffect, useCallback } from "react";
import type { LiffProfile } from "@/lib/liff";

type Props = { liffProfile: LiffProfile | null };

type SeatStatus = "available" | "reserved_self" | "reserved_other" | "occupied_self" | "occupied_other";

type Seat = {
  id: string;
  zone: "solo" | "free" | "reading";
  zone_label: string;
  table_number: number | null;
  is_reservable: boolean;
  max_duration_min: number | null;
  status: SeatStatus;
  occupant: string | null;
  ends_at: string | null;
  reservation_id: string | null;
};

type ZoneSummary = { zone: string; total: number; available: number };

const STATUS_COLORS: Record<SeatStatus, { bg: string; border: string; text: string }> = {
  available:       { bg: "#FFFFFF", border: "#E0D5C8", text: "#2D2D2D" },
  reserved_self:   { bg: "#FFF3E6", border: "#FFB057", text: "#C87A20" },
  reserved_other:  { bg: "#F0EDEB", border: "#D0C8C0", text: "#9E9590" },
  occupied_self:   { bg: "#E8F8F0", border: "#5CC9A7", text: "#2A8A65" },
  occupied_other:  { bg: "#F0EDEB", border: "#D0C8C0", text: "#9E9590" },
};

const HOURS = [15, 16, 17, 18, 19];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function SeatScreen({ liffProfile }: Props) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [summary, setSummary] = useState<ZoneSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Time picker state (solo seats)
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [pickHour, setPickHour] = useState(16);
  const [pickMin, setPickMin] = useState(0);

  // Confirm dialog state (free/reading)
  const [confirmSeat, setConfirmSeat] = useState<Seat | null>(null);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Seat | null>(null);

  const studentId = liffProfile?.userId ?? "guest";

  const fetchSeats = useCallback(async () => {
    const res = await fetch(`/api/seats?action=availability&student_id=${encodeURIComponent(studentId)}`);
    const data = await res.json();
    if (data.seats) setSeats(data.seats);
    if (data.summary) setSummary(data.summary);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { fetchSeats(); }, [fetchSeats]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(fetchSeats, 30000);
    return () => clearInterval(iv);
  }, [fetchSeats]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const api = async (body: Record<string, unknown>) => {
    setActionLoading(true);
    const res = await fetch("/api/seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, student_id: studentId }),
    });
    const data = await res.json();
    setActionLoading(false);
    return { ok: res.ok, data };
  };

  // ─── Handlers ───

  const handleSeatTap = (seat: Seat) => {
    // Own seat → cancel dialog
    if (seat.status === "reserved_self" || seat.status === "occupied_self") {
      setCancelTarget(seat);
      return;
    }
    // Unavailable
    if (seat.status !== "available") return;

    if (seat.zone === "solo") {
      setSelectedSeat(selectedSeat === seat.id ? null : seat.id);
      setConfirmSeat(null);
    } else {
      setConfirmSeat(seat);
      setSelectedSeat(null);
    }
  };

  const handleReserve = async () => {
    if (!selectedSeat) return;
    const startTime = `${String(pickHour).padStart(2, "0")}:${String(pickMin).padStart(2, "0")}`;
    const { ok, data } = await api({ action: "reserve", seat_id: selectedSeat, start_time: startTime });
    if (ok) {
      showToast(`${selectedSeat} を予約したよ！ ✨`);
      setSelectedSeat(null);
      fetchSeats();
    } else {
      showToast(data.error ?? "予約できませんでした");
    }
  };

  const handleOccupy = async () => {
    if (!confirmSeat) return;
    const { ok, data } = await api({ action: "occupy", seat_id: confirmSeat.id });
    if (ok) {
      const dur = data.duration_min ?? (confirmSeat.zone === "reading" ? 30 : 120);
      showToast(`${confirmSeat.id} を使い始めたよ！（${dur}分）`);
      setConfirmSeat(null);
      fetchSeats();
    } else {
      showToast(data.error ?? "使えませんでした");
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (cancelTarget.status === "reserved_self" && cancelTarget.reservation_id) {
      const { ok, data } = await api({ action: "cancel_reservation", reservation_id: cancelTarget.reservation_id });
      if (ok) { showToast("予約をキャンセルしたよ"); }
      else { showToast(data.error ?? "キャンセルできませんでした"); }
    } else if (cancelTarget.status === "occupied_self") {
      const { ok, data } = await api({ action: "release", seat_id: cancelTarget.id });
      if (ok) { showToast("席を解放したよ"); }
      else { showToast(data.error ?? "解放できませんでした"); }
    }
    setCancelTarget(null);
    fetchSeats();
  };

  // Check if block_end exceeds 22:00
  const blockEndExceeds = (() => {
    const start = new Date();
    start.setHours(pickHour, pickMin, 0, 0);
    const blockEnd = new Date(start.getTime() + 120 * 60000);
    const limit = new Date();
    limit.setHours(22, 0, 0, 0);
    return blockEnd > limit;
  })();

  // ─── Seat groups ───
  const soloSeats = seats.filter((s) => s.zone === "solo");
  const freeSeats = seats.filter((s) => s.zone === "free");
  const readSeats = seats.filter((s) => s.zone === "reading");

  // Group free seats by table
  const freeTables = new Map<number, Seat[]>();
  freeSeats.forEach((s) => {
    const t = s.table_number ?? 0;
    if (!freeTables.has(t)) freeTables.set(t, []);
    freeTables.get(t)!.push(s);
  });

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
        <p className="text-3xl mb-1">💺</p>
        <h1 className="text-lg font-bold text-[#2D2D2D]">座席マップ</h1>
      </div>

      {/* Zone summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[
          { z: "solo", label: "ひとり席", icon: "🪑", color: "#5B9BF5" },
          { z: "free", label: "自由席", icon: "🪑", color: "#F97316" },
          { z: "reading", label: "読書", icon: "📖", color: "#9B59B6" },
        ].map(({ z, label, icon, color }) => {
          const s = summary.find((x) => x.zone === z);
          return (
            <div key={z} className="bg-white border border-[#F0E6D6] rounded-xl p-3 text-center shadow-sm">
              <p className="text-lg">{icon}</p>
              <p className="text-xl font-bold" style={{ color }}>
                {s?.available ?? 0}<span className="text-xs text-[#8C7B6B] font-normal">/{s?.total ?? 0}</span>
              </p>
              <p className="text-[10px] text-[#8C7B6B]">{label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Solo seats ── */}
      <SectionLabel text="🪑 ひとり席" sub="予約制・110分学習+10分片付け" />
      <div className="grid grid-cols-5 gap-3 mb-2.5">
        {soloSeats.slice(0, 5).map((s) => (
          <SeatButton key={s.id} seat={s} selected={selectedSeat === s.id} onTap={handleSeatTap} size="md" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3 mb-3">
        {soloSeats.slice(5, 10).map((s) => (
          <SeatButton key={s.id} seat={s} selected={selectedSeat === s.id} onTap={handleSeatTap} size="md" />
        ))}
      </div>

      {/* Time picker (when solo seat selected) */}
      {selectedSeat && (
        <div className="bg-white border border-[#5B9BF5]/30 rounded-xl p-4 mb-4 animate-fade-in">
          <p className="text-sm font-semibold text-[#2D2D2D] mb-3">
            {selectedSeat} の開始時間を選んでね
          </p>
          <div className="flex gap-3 mb-3">
            {/* Hour */}
            <div className="flex-1">
              <p className="text-[10px] text-[#8C7B6B] mb-1">時</p>
              <div className="flex flex-wrap gap-1.5">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setPickHour(h)}
                    className="w-10 h-8 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: pickHour === h ? "#5B9BF5" : "#F5F0EB",
                      color: pickHour === h ? "#FFF" : "#6B6B6B",
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            {/* Minute */}
            <div className="flex-1">
              <p className="text-[10px] text-[#8C7B6B] mb-1">分</p>
              <div className="flex flex-wrap gap-1.5">
                {MINUTES.filter((_, i) => i % 3 === 0 || pickMin === MINUTES[i]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPickMin(m)}
                    className="w-10 h-8 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: pickMin === m ? "#5B9BF5" : "#F5F0EB",
                      color: pickMin === m ? "#FFF" : "#6B6B6B",
                    }}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-[#8C7B6B] mb-3">
            {String(pickHour).padStart(2, "0")}:{String(pickMin).padStart(2, "0")} 開始
            → 学習終了 {fmtAddMin(pickHour, pickMin, 110)}
            → 片付け {fmtAddMin(pickHour, pickMin, 120)}
          </p>
          {blockEndExceeds && (
            <p className="text-xs text-[#E85D5D] mb-2">⚠ 22:00を超えるため予約できません</p>
          )}
          <button
            onClick={handleReserve}
            disabled={actionLoading || blockEndExceeds}
            className="w-full bg-[#5B9BF5] hover:bg-[#4A8AE4] disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all text-sm"
          >
            {actionLoading ? "処理中..." : "予約する ✨"}
          </button>
        </div>
      )}

      {/* ── Free seats ── */}
      <SectionLabel text="🪑 自由席" sub="先着順・2時間" />
      <div className="flex gap-5 justify-center mb-5">
        {Array.from(freeTables.entries()).map(([table, tableSeats]) => (
          <div key={table} className="flex flex-col gap-2.5 items-center">
            <p className="text-xs text-[#8C7B6B] font-semibold">卓{table}</p>
            {tableSeats.map((s) => (
              <SeatButton key={s.id} seat={s} selected={false} onTap={handleSeatTap} size="lg" />
            ))}
          </div>
        ))}
      </div>

      {/* ── Reading seats ── */}
      <SectionLabel text="📖 読書スペース" sub="先着順・30分・1日1回" />
      <div className="flex gap-3 justify-center mb-6">
        {readSeats.map((s) => (
          <SeatButton key={s.id} seat={s} selected={false} onTap={handleSeatTap} size="lg" />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-[10px] text-[#8C7B6B]">
        <span><span className="inline-block w-3 h-3 rounded border border-[#E0D5C8] bg-white mr-1 align-middle" />空き</span>
        <span><span className="inline-block w-3 h-3 rounded bg-[#5B9BF5] mr-1 align-middle" />選択中</span>
        <span><span className="inline-block w-3 h-3 rounded bg-[#FFB057] mr-1 align-middle" />予約(自分)</span>
        <span><span className="inline-block w-3 h-3 rounded bg-[#5CC9A7] mr-1 align-middle" />利用中(自分)</span>
        <span><span className="inline-block w-3 h-3 rounded bg-[#D0C8C0] mr-1 align-middle" />利用中</span>
      </div>

      {/* ── Confirm dialog (free/reading) ── */}
      {confirmSeat && (
        <Dialog onClose={() => setConfirmSeat(null)}>
          <p className="text-lg font-bold text-center mb-2">{confirmSeat.id} を使う</p>
          <p className="text-sm text-[#6B6B6B] text-center mb-4">
            今から{confirmSeat.zone === "reading" ? "30分" : "2時間"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleOccupy}
              disabled={actionLoading}
              className="flex-1 bg-[#F97316] hover:bg-[#EA6A0C] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all"
            >
              {actionLoading ? "処理中..." : "使う！"}
            </button>
            <button
              onClick={() => setConfirmSeat(null)}
              className="flex-1 bg-[#F5F0EB] text-[#6B6B6B] font-bold py-3 rounded-xl text-sm transition-all"
            >
              やめる
            </button>
          </div>
        </Dialog>
      )}

      {/* ── Cancel dialog ── */}
      {cancelTarget && (
        <Dialog onClose={() => setCancelTarget(null)}>
          <p className="text-lg font-bold text-center mb-2">
            {cancelTarget.id} を{cancelTarget.status === "reserved_self" ? "キャンセル" : "解放"}する？
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex-1 bg-[#E85D5D] hover:bg-[#D14D4D] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all"
            >
              {actionLoading ? "処理中..." : cancelTarget.status === "reserved_self" ? "キャンセル" : "解放する"}
            </button>
            <button
              onClick={() => setCancelTarget(null)}
              className="flex-1 bg-[#F5F0EB] text-[#6B6B6B] font-bold py-3 rounded-xl text-sm transition-all"
            >
              やめる
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ─── Sub-components ───

function SeatButton({ seat, selected, onTap, size = "md" }: { seat: Seat; selected: boolean; onTap: (s: Seat) => void; size?: "md" | "lg" }) {
  const isMine = seat.status === "reserved_self" || seat.status === "occupied_self";
  const isOther = seat.status === "reserved_other" || seat.status === "occupied_other";
  const colors = selected
    ? { bg: "#EBF2FF", border: "#5B9BF5", text: "#3A7CE8" }
    : STATUS_COLORS[seat.status];

  const sizeClass = size === "lg"
    ? "min-w-[64px] min-h-[64px] p-3.5 text-base"
    : "min-w-[56px] min-h-[56px] p-2.5 text-sm";

  return (
    <button
      onClick={() => onTap(seat)}
      disabled={isOther}
      className={`relative w-full aspect-square rounded-xl flex flex-col items-center justify-center font-bold transition-all active:scale-95 disabled:cursor-not-allowed ${sizeClass}`}
      style={{
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        opacity: isOther ? 0.6 : 1,
      }}
    >
      <span className={size === "lg" ? "text-base" : "text-sm"}>{seat.id}</span>
      {isMine && <span className="text-[9px] mt-0.5">{seat.status === "reserved_self" ? "予約" : "利用中"}</span>}
    </button>
  );
}

function SectionLabel({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-sm font-bold text-[#2D2D2D]">{text}</h2>
      <p className="text-[10px] text-[#8C7B6B]">{sub}</p>
    </div>
  );
}

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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

function fmtAddMin(h: number, m: number, addMin: number): string {
  const total = h * 60 + m + addMin;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
