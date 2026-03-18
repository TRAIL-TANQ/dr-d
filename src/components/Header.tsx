"use client";

import type { Profile } from "@/lib/types";
import { getLevel, getTitleForLevel } from "@/lib/constants";

interface Props {
  profile: Profile | null;
  onToggleHistory: () => void;
}

export default function Header({ profile, onToggleHistory }: Props) {
  const lvl = getLevel(profile?.xp ?? 0);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-[#E8DDD0] shadow-sm">
      {/* Left: Logo + XP */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-2xl">🧬</span>
          <span className="text-xl font-bold bg-gradient-to-r from-drd-amber to-[#D4883A] bg-clip-text text-transparent">
            Dr.D
          </span>
        </div>

        {profile && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs font-bold bg-drd-amber/15 text-drd-amber px-2 py-0.5 rounded-md">
              Lv.{lvl.level} {getTitleForLevel(lvl.level)}
            </span>
            <div className="w-16 h-1.5 rounded-full bg-[#E8DDD0] overflow-hidden">
              <div
                className="h-full rounded-full bg-drd-amber transition-all duration-700"
                style={{ width: `${(lvl.cur / lvl.next) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[#8C7B6B] font-semibold">
              {profile.xp}XP
            </span>
          </div>
        )}
      </div>

      {/* Right: History button */}
      {profile && (
        <button
          className="text-sm font-semibold text-[#8C7B6B] hover:text-[#333] transition-colors px-3 py-1.5 rounded-lg hover:bg-drd-bg3"
          onClick={onToggleHistory}
        >
          📊 きろく
        </button>
      )}
    </header>
  );
}
