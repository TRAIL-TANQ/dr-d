"use client";

import { useState, useEffect } from "react";
import { initLiff, getProfile, type LiffProfile } from "@/lib/liff";
import DrDScreen from "@/components/screens/DrDScreen";
import CheckinScreen from "@/components/screens/CheckinScreen";
import SeatScreen from "@/components/screens/SeatScreen";
import TimerScreen from "@/components/screens/TimerScreen";
import ReportScreen from "@/components/screens/ReportScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";

type Screen = "checkin" | "seat" | "drd" | "timer" | "report" | "settings";

const VALID_SCREENS: Screen[] = ["checkin", "seat", "drd", "timer", "report", "settings"];

export default function Home() {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [liffProfile, setLiffProfile] = useState<LiffProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const screenParam = await initLiff();
      const s = VALID_SCREENS.includes(screenParam as Screen)
        ? (screenParam as Screen)
        : "checkin";
      setScreen(s);

      const profile = await getProfile();
      if (profile) setLiffProfile(profile);

      setReady(true);
    })();
  }, []);

  if (!ready || !screen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF9F0]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#E8793B]/30 border-t-[#E8793B] rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#8C7B6B]">読み込み中...</p>
        </div>
      </div>
    );
  }

  switch (screen) {
    case "drd":
      return <DrDScreen />;
    case "checkin":
      return <CheckinScreen liffProfile={liffProfile} />;
    case "seat":
      return <SeatScreen />;
    case "timer":
      return <TimerScreen liffProfile={liffProfile} />;
    case "report":
      return <ReportScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return <CheckinScreen liffProfile={liffProfile} />;
  }
}
