"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import ProgressDots from "@/components/ProgressDots";
import HistoryPanel from "@/components/HistoryPanel";
import TypeWriter from "@/components/TypeWriter";
import QuizInner from "@/components/QuizInner";
import { GRADES, GS, XP_C, XP_S, XP_F, getLevel } from "@/lib/constants";
import type { Grade } from "@/lib/constants";
import type { QuizQuestion, SessionResult, Profile, HistoryEntry, Report } from "@/lib/types";

const PHASE_DOTS = ["topic", "subtopic", "assessment", "difficulty", "quiz", "results", "finalCheck", "report"];
const LOADING_MSGS = [
  "脳みそウォーミングアップ中...",
  "知識のカプセルを調合中...",
  "ニューロンを整列させています...",
  "Dr.Dが論文を読んでいます...",
  "クイズの難易度を調整中...",
];
function randomMsg() {
  return LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
}

type Phase =
  | "welcome" | "topic" | "subtopic" | "generating" | "assessment"
  | "difficulty" | "generating2" | "quiz" | "scoring" | "results"
  | "finalCheck" | "finalResults" | "report";

export default function Home() {
  // --- State ---
  const [phase, setPhase] = useState<Phase>("welcome");
  const [animIn, setAnimIn] = useState(true);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showH, setShowH] = useState(false);

  const [topic, setTopic] = useState("");
  const [custom, setCustom] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [customSub, setCustomSub] = useState("");
  const [subChoices, setSubChoices] = useState<string[]>([]);

  const [aQs, setAQs] = useState<QuizQuestion[]>([]);
  const [aIdx, setAIdx] = useState(0);
  const [aAns, setAAns] = useState<SessionResult[]>([]);
  const [aScore, setAScore] = useState(0);

  const [diff, setDiff] = useState(3);
  const [sugDiff, setSugDiff] = useState(3);

  const [qQs, setQQs] = useState<QuizQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [qAns, setQAns] = useState<SessionResult[]>([]);
  const [qScore, setQScore] = useState(0);

  const [plan, setPlan] = useState("");
  const [fQs, setFQs] = useState<QuizQuestion[]>([]);
  const [fIdx, setFIdx] = useState(0);
  const [fAns, setFAns] = useState<SessionResult[]>([]);

  const [report, setReport] = useState<Report | null>(null);
  const [loadMsg, setLoadMsg] = useState("");

  // --- Helpers ---
  const go = useCallback((next: Phase) => {
    setAnimIn(false);
    setTimeout(() => { setPhase(next); setAnimIn(true); }, 300);
  }, []);

  const subs = grade ? (GS[grade as Grade] ?? []) : [];
  const phaseIdx = PHASE_DOTS.indexOf(phase);

  // --- Welcome ---
  function onWelcome() {
    if (!name.trim() || !grade) return;
    const p: Profile = profile
      ? { ...profile, name: name.trim(), grade }
      : { name: name.trim(), grade, xp: 0, sessions: 0 };
    setProfile(p);
    go("topic");
  }

  // --- Topic ---
  function onTopicSubmit() {
    const t = custom.trim() || topic;
    if (!t) return;
    setTopic(t);
    const found = subs.find((s) => s.subject === t);
    setSubChoices(found?.subs ?? []);
    setSubtopic("");
    setCustomSub("");
    go("subtopic");
  }

  // --- Try bank first, fallback to AI generation ---
  async function fetchFromBankOrAI(
    endpoint: string,
    aiBody: Record<string, unknown>,
    bankParams: { textbook?: string; chapter?: string; section?: string; difficulty?: number; count: number },
  ): Promise<QuizQuestion[] | null> {
    // Try bank first if we have textbook params
    if (bankParams.textbook && bankParams.chapter) {
      try {
        const params = new URLSearchParams({
          textbook: bankParams.textbook,
          chapter: bankParams.chapter,
          count: String(bankParams.count),
        });
        if (bankParams.section) params.set("section", bankParams.section);
        if (bankParams.difficulty) params.set("difficulty", String(bankParams.difficulty));
        const res = await fetch(`/api/quiz/bank?${params}`);
        const data = await res.json();
        if (data.questions?.length >= bankParams.count) {
          return data.questions;
        }
      } catch { /* fall through to AI */ }
    }
    // Fallback: AI generation
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiBody),
      });
      const data = await res.json();
      return data.questions ?? null;
    } catch {
      return null;
    }
  }

  // --- Map topic/subtopic to bank's chapter/section ---
  function toBankParams(t: string, st: string) {
    if (t === "数学" && grade === "中1") {
      // Map GS subtopics to 体系数学1 chapters
      const mapping: Record<string, { chapter: string; section?: string }> = {
        "正負の数": { chapter: "正の数・負の数" },
        "文字と式": { chapter: "文字と式" },
        "一次方程式": { chapter: "一次方程式" },
        "比例と反比例": { chapter: "比例と反比例" },
        "平面図形": { chapter: "平面図形" },
        "空間図形": { chapter: "空間図形" },
      };
      const found = mapping[st];
      if (found) return { textbook: "体系数学1", ...found };
    }
    return { textbook: undefined, chapter: undefined };
  }

  // --- Subtopic → Assessment ---
  async function onSubtopicSubmit() {
    const st = customSub.trim() || subtopic;
    if (!st) return;
    setSubtopic(st);
    go("generating");
    setLoadMsg(randomMsg());
    const bank = toBankParams(topic, st);
    const questions = await fetchFromBankOrAI(
      "/api/quiz/generate",
      { name, grade, topic, subtopic: st },
      { ...bank, count: 5 },
    );
    if (questions && questions.length > 0) {
      setAQs(questions.slice(0, 5));
      setAIdx(0); setAAns([]); setAScore(0);
      go("assessment");
    } else {
      go("difficulty");
    }
  }

  // --- Assessment callbacks ---
  function onAResult(r: SessionResult) {
    setAAns((prev) => [...prev, r]);
    if (r.correct) setAScore((s) => s + 1);
  }
  function onAFinish(action: "next" | "done") {
    if (action === "next") { setAIdx((i) => i + 1); }
    else {
      const sg = aScore <= 1 ? 1 : aScore === 2 ? 2 : aScore === 3 ? 3 : aScore === 4 ? 4 : 5;
      setSugDiff(sg); setDiff(sg);
      go("difficulty");
    }
  }

  // --- Start Quiz ---
  async function onStartQuiz() {
    go("generating2");
    setLoadMsg(randomMsg());
    const ctx = aQs.map((q, i) =>
      `問${i + 1}:${q.q}→${aAns[i]?.correct ? "⭕" : "❌"}`
    ).join("\n");
    const bank = toBankParams(topic, subtopic);
    const questions = await fetchFromBankOrAI(
      "/api/quiz/main",
      { name, grade, topic, subtopic, difficulty: diff, assessScore: aScore, assessContext: ctx },
      { ...bank, difficulty: diff, count: 10 },
    );
    if (questions && questions.length > 0) {
      setQQs(questions); setQIdx(0); setQAns([]); setQScore(0);
      go("quiz");
    } else {
      setLoadMsg("生成失敗…もう一度お試しください");
    }
  }

  // --- Quiz callbacks ---
  function onQResult(r: SessionResult) {
    setQAns((prev) => [...prev, r]);
    if (r.correct) setQScore((s) => s + 1);
  }
  function onQFinish(action: "next" | "done") {
    if (action === "next") { setQIdx((i) => i + 1); }
    else { go("scoring"); doResults(); }
  }

  async function doResults() {
    setLoadMsg("診断結果を分析中...");
    const det = qQs.map((q, i) =>
      `問${i + 1}:${q.q}→${qAns[i]?.correct ? "⭕" : qAns[i]?.skipped ? "⏭" : "❌"}`
    ).join("\n");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, grade, topic, difficulty: diff, quizScore: qScore, details: det }),
      });
      const data = await res.json();
      setPlan(data.plan ?? "生成失敗");
    } catch {
      setPlan("生成失敗");
    }
    go("results");
  }

  // --- Final Check ---
  async function startFinal() {
    go("generating");
    setLoadMsg("最終確認を準備中...");
    try {
      const res = await fetch("/api/quiz/final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, grade, topic, quizScore: qScore, plan }),
      });
      const data = await res.json();
      if (data.questions) {
        setFQs(data.questions); setFIdx(0); setFAns([]);
        go("finalCheck");
      } else {
        doReport(0);
      }
    } catch {
      doReport(0);
    }
  }
  function onFResult(r: SessionResult) { setFAns((prev) => [...prev, r]); }
  function onFFinish(action: "next" | "done") {
    if (action === "next") { setFIdx((i) => i + 1); }
    else { go("finalResults"); }
  }

  // --- Report ---
  function doReport(overFs?: number) {
    go("generating");
    setLoadMsg("カルテを作成中...");
    const fs = overFs ?? fAns.filter((a) => a.correct).length;
    const xp = qScore * XP_C + XP_S + fs * XP_F;
    const np: Profile = {
      ...profile!,
      xp: (profile?.xp ?? 0) + xp,
      sessions: (profile?.sessions ?? 0) + 1,
      lastDate: new Date().toISOString().split("T")[0],
    };
    setProfile(np);
    const nh: HistoryEntry[] = [
      { date: new Date().toISOString(), topic, subtopic, grade, difficulty: diff, quizScore: qScore, finalScore: fs, assessScore: aScore, xpEarned: xp },
      ...history,
    ].slice(0, 50);
    setHistory(nh);
    setReport({
      name, grade, topic, subtopic, difficulty: diff,
      date: new Date().toLocaleDateString("ja-JP"),
      quizScore: qScore, assessScore: aScore, finalScore: fs,
      totalXP: xp, totalXPAll: np.xp, sessions: np.sessions,
      learningPlan: plan, level: getLevel(np.xp),
    });
    go("report");
  }

  // --- Reset ---
  function reset() {
    setTopic(""); setCustom(""); setSubtopic(""); setCustomSub(""); setSubChoices([]);
    setAQs([]); setAIdx(0); setAAns([]); setAScore(0);
    setDiff(3); setSugDiff(3); setQQs([]); setQIdx(0); setQAns([]); setQScore(0);
    setPlan(""); setFQs([]); setFIdx(0); setFAns([]); setReport(null); setShowH(false);
    go("topic");
  }

  // --- Render ---
  return (
    <div className="min-h-dvh flex flex-col">
      <Header profile={profile} onToggleHistory={() => setShowH((v) => !v)} />

      {phase !== "welcome" && <ProgressDots phases={PHASE_DOTS} current={phaseIdx} />}

      {showH && <HistoryPanel history={history} onClose={() => setShowH(false)} />}

      <main
        className="flex-1 flex items-start justify-center px-4 py-6 transition-all duration-300"
        style={{ opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(20px)" }}
      >
        {/* ===== Welcome ===== */}
        {phase === "welcome" && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6 sm:p-8">
            <div className="text-center text-6xl mb-2">🧬</div>
            <h1 className="text-center text-3xl font-bold bg-gradient-to-r from-drd-amber to-[#e8c468] bg-clip-text text-transparent mb-1">
              Dr.D
            </h1>
            <p className="text-center text-[#8b949e] text-sm mb-6">きみの学びを、診断しよう。</p>

            <div className="bg-drd-bg3 rounded-xl px-4 py-3 text-sm text-[#8b949e] text-center mb-6">
              科目をえらんで → 理解度チェック → 診断クイズ → 学習プラン処方！
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-[#8b949e] mb-1.5">なまえを教えてね</label>
              <input
                className="w-full bg-drd-bg border border-[#30363d] rounded-xl px-4 py-3 text-sm outline-none focus:border-drd-amber transition-colors placeholder:text-[#484f58]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ニックネームでもOK"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#8b949e] mb-1.5">学年をえらんでね</label>
              <div className="grid grid-cols-6 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                      grade === g
                        ? "bg-drd-amber text-drd-bg"
                        : "bg-drd-bg border border-[#30363d] text-[#8b949e] hover:border-drd-amber/50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 disabled:opacity-40 disabled:cursor-not-allowed text-drd-bg font-bold py-3.5 rounded-xl transition-colors text-base"
              onClick={onWelcome}
              disabled={!name.trim() || !grade}
            >
              {profile ? "おかえり！はじめる" : "はじめる"} →
            </button>
          </div>
        )}

        {/* ===== Topic ===== */}
        {phase === "topic" && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="text-3xl">🧬</span>
              <div className="bg-drd-bg3 rounded-xl rounded-tl-none px-4 py-3 text-sm">
                <TypeWriter text={`${name}さん（${grade}）、今日はどの科目を学ぶ？`} />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-[#8b949e] mb-2">📚 {grade}の科目からえらぶ</label>
              <div className="grid grid-cols-2 gap-2">
                {subs.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setTopic(s.subject); setCustom(""); }}
                    className={`text-left rounded-xl p-3 border transition-all ${
                      topic === s.subject && !custom
                        ? "bg-drd-amber/15 border-drd-amber"
                        : "bg-drd-bg border-[#30363d] hover:border-drd-amber/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{s.icon}</span>
                      <span className="font-bold text-sm">{s.subject}</span>
                    </div>
                    <p className="text-xs text-[#8b949e] leading-relaxed">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#8b949e] mb-1.5">✏️ 自分で入力してもOK</label>
              <input
                className="w-full bg-drd-bg border border-[#30363d] rounded-xl px-4 py-3 text-sm outline-none focus:border-drd-amber transition-colors placeholder:text-[#484f58]"
                value={custom}
                onChange={(e) => { setCustom(e.target.value); if (e.target.value) setTopic(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") onTopicSubmit(); }}
                placeholder="例: プログラミング、天文学..."
              />
            </div>

            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 disabled:opacity-40 disabled:cursor-not-allowed text-drd-bg font-bold py-3.5 rounded-xl transition-colors"
              onClick={onTopicSubmit}
              disabled={!topic && !custom.trim()}
            >
              つぎへ →
            </button>
          </div>
        )}

        {/* ===== Subtopic ===== */}
        {phase === "subtopic" && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="text-3xl">🧬</span>
              <div className="bg-drd-bg3 rounded-xl rounded-tl-none px-4 py-3 text-sm">
                <TypeWriter text={`${topic}のなかで、どの範囲を学びたい？`} />
              </div>
            </div>

            {subChoices.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-[#8b949e] mb-2">📎 {topic}の範囲からえらぶ</label>
                <div className="flex flex-wrap gap-2">
                  {subChoices.map((sc, i) => (
                    <button
                      key={i}
                      onClick={() => { setSubtopic(sc); setCustomSub(""); }}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                        subtopic === sc && !customSub
                          ? "bg-drd-amber/15 border-drd-amber text-drd-amber"
                          : "bg-drd-bg border-[#30363d] text-[#8b949e] hover:border-drd-amber/40"
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#8b949e] mb-1.5">✏️ 自分で範囲を入力してもOK</label>
              <input
                className="w-full bg-drd-bg border border-[#30363d] rounded-xl px-4 py-3 text-sm outline-none focus:border-drd-amber transition-colors placeholder:text-[#484f58]"
                value={customSub}
                onChange={(e) => { setCustomSub(e.target.value); if (e.target.value) setSubtopic(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") onSubtopicSubmit(); }}
                placeholder={`例: ${subChoices[0] ?? "具体的な単元名"}...`}
              />
            </div>

            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 disabled:opacity-40 disabled:cursor-not-allowed text-drd-bg font-bold py-3.5 rounded-xl transition-colors"
              onClick={onSubtopicSubmit}
              disabled={!subtopic && !customSub.trim()}
            >
              理解度チェックへ →
            </button>
          </div>
        )}

        {/* ===== Generating / Loading ===== */}
        {(phase === "generating" || phase === "generating2" || phase === "scoring") && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6">
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-10 h-10 border-3 border-drd-amber/30 border-t-drd-amber rounded-full animate-spin" />
              <p className="text-sm text-[#8b949e]">{loadMsg}</p>
            </div>
          </div>
        )}

        {/* ===== Assessment ===== */}
        {phase === "assessment" && aQs.length > 0 && (
          <QuizInner
            key={`a-${aIdx}`}
            tag="🩺 理解度チェック"
            q={aQs[aIdx]}
            idx={aIdx}
            total={aQs.length}
            onResult={onAResult}
            onFinish={onAFinish}
            finishLabel="結果を見る →"
          />
        )}

        {/* ===== Difficulty ===== */}
        {phase === "difficulty" && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="text-3xl">🧬</span>
              <div className="bg-drd-bg3 rounded-xl rounded-tl-none px-4 py-3 text-sm">
                <TypeWriter
                  text={`理解度チェック ${aScore}/${aQs.length}問正解！${aScore >= 4 ? "すごい💪" : aScore >= 2 ? "いい感じ！" : "これから伸びるよ🌱"}`}
                />
              </div>
            </div>

            <div className="text-center mb-5">
              <span className="text-5xl font-bold">{aScore}</span>
              <span className="text-xl text-[#8b949e]">/{aQs.length}</span>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#8b949e] mb-2">
                🎯 Dr.Dのおすすめ → <strong className="text-drd-amber">Lv.{sugDiff}</strong>　変えてもOK！
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setDiff(lv)}
                    className={`flex flex-col items-center py-3 rounded-xl border transition-all text-center ${
                      diff === lv
                        ? "bg-drd-amber/15 border-drd-amber"
                        : "bg-drd-bg border-[#30363d] hover:border-drd-amber/40"
                    } ${sugDiff === lv ? "ring-2 ring-drd-amber/50" : ""}`}
                  >
                    <span className="text-lg font-bold">{lv}</span>
                    <span className="text-[10px] text-[#8b949e]">
                      {["かんたん", "ふつう", "ちょいムズ", "むずかしい", "超ムズ"][lv - 1]}
                    </span>
                    <span className="text-[10px] mt-0.5">{"★".repeat(lv) + "☆".repeat(5 - lv)}</span>
                    {sugDiff === lv && (
                      <span className="text-[9px] mt-1 bg-drd-amber/20 text-drd-amber px-1.5 py-0.5 rounded">おすすめ</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 text-drd-bg font-bold py-3.5 rounded-xl transition-colors"
              onClick={onStartQuiz}
            >
              この難易度で診断スタート！ →
            </button>
          </div>
        )}

        {/* ===== Quiz ===== */}
        {phase === "quiz" && qQs.length > 0 && (
          <QuizInner
            key={`q-${qIdx}`}
            tag={`🔬 診断クイズ（Lv.${diff}）`}
            q={qQs[qIdx]}
            idx={qIdx}
            total={10}
            onResult={onQResult}
            onFinish={onQFinish}
            finishLabel="結果を見る →"
          />
        )}

        {/* ===== Results / Prescription ===== */}
        {phase === "results" && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6">
            <div className="text-center text-xs font-bold text-drd-amber bg-drd-amber/10 rounded-lg py-1.5 mb-5">
              💊 処方箋
            </div>

            <div className="flex justify-center mb-6">
              <div className="relative">
                <svg viewBox="0 0 120 120" className="w-28 h-28">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={qScore >= 7 ? "#2ec4b2" : qScore >= 4 ? "#f4a261" : "#e76f51"}
                    strokeWidth="8"
                    strokeDasharray={`${(qScore / 10) * 327} 327`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold">{qScore}</span>
                  <span className="text-base text-[#8b949e]">/10</span>
                </div>
              </div>
            </div>
            <p className="text-center text-lg font-semibold mb-5">
              {qScore >= 8 ? "すばらしい！🌟" : qScore >= 5 ? "いい感じ！💪" : "のびしろいっぱい！🌱"}
            </p>

            <div className="bg-drd-bg rounded-xl border border-[#30363d] px-4 py-4 mb-5">
              {plan.split("\n").filter(Boolean).map((l, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed mb-2 ${
                    l.startsWith("📌") ? "text-drd-amber font-medium" : "text-[#8b949e]"
                  }`}
                >
                  {l}
                </p>
              ))}
            </div>

            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 text-drd-bg font-bold py-3.5 rounded-xl transition-colors"
              onClick={startFinal}
            >
              経過観察へすすむ →
            </button>
          </div>
        )}

        {/* ===== Final Check ===== */}
        {phase === "finalCheck" && fQs.length > 0 && (
          <QuizInner
            key={`f-${fIdx}`}
            tag="🔍 経過観察"
            q={fQs[fIdx]}
            idx={fIdx}
            total={fQs.length}
            onResult={onFResult}
            onFinish={onFFinish}
            finishLabel="カルテを作成 →"
          />
        )}

        {/* ===== Final Results ===== */}
        {phase === "finalResults" && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6">
            <div className="text-center text-xs font-bold text-drd-purple-light bg-drd-purple/10 rounded-lg py-1.5 mb-5">
              🔍 経過観察の結果
            </div>
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-[#8b949e]">最終確認</span>
              <span className="text-5xl font-bold bg-gradient-to-r from-drd-teal to-drd-purple bg-clip-text text-transparent">
                {fAns.filter((a) => a.correct).length}/{fQs.length}
              </span>
            </div>
            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 text-drd-bg font-bold py-3.5 rounded-xl transition-colors"
              onClick={() => doReport()}
            >
              カルテを作成する →
            </button>
          </div>
        )}

        {/* ===== Report ===== */}
        {phase === "report" && report && (
          <div className="animate-fade-in w-full max-w-lg bg-drd-bg2 border border-[#30363d] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">📋</span>
              <h2 className="text-xl font-bold">学習カルテ</h2>
            </div>

            <div className="bg-drd-bg rounded-xl border border-[#30363d] p-4 mb-5 space-y-4">
              {/* Meta */}
              <div className="flex justify-between text-sm text-[#8b949e]">
                <span>👤 {report.name}（{report.grade}）</span>
                <span>📅 {report.date}</span>
              </div>

              {/* Subject */}
              <div>
                <h3 className="text-xs font-bold text-[#8b949e] mb-1">📚 科目</h3>
                <p className="text-lg font-semibold">{report.topic}</p>
                {report.subtopic && <p className="text-sm text-[#8b949e] mt-0.5">📎 範囲: {report.subtopic}</p>}
                <span className="text-xs text-[#484f58] mt-1 inline-block">
                  難易度 {"★".repeat(report.difficulty) + "☆".repeat(5 - report.difficulty)}
                </span>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-drd-bg2 rounded-xl py-3">
                  <div className="text-xs text-[#8b949e] mb-1">理解度</div>
                  <div className="text-lg font-bold text-drd-purple-light">{report.assessScore}/5</div>
                </div>
                <div className="text-center bg-drd-bg2 rounded-xl py-3">
                  <div className="text-xs text-[#8b949e] mb-1">診断</div>
                  <div className={`text-lg font-bold ${report.quizScore >= 7 ? "text-drd-teal" : "text-drd-amber"}`}>
                    {report.quizScore}/10
                  </div>
                </div>
                <div className="text-center bg-drd-bg2 rounded-xl py-3">
                  <div className="text-xs text-[#8b949e] mb-1">最終確認</div>
                  <div className="text-lg font-bold">{report.finalScore}/{fQs.length || 3}</div>
                </div>
              </div>

              {/* XP */}
              <div className="bg-drd-amber/10 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-drd-amber">✨ 獲得XP</span>
                  <span className="text-2xl font-bold text-drd-amber">+{report.totalXP}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8b949e] mt-2">
                  <span>Lv.{report.level.level}</span>
                  <span>累計 {report.totalXPAll} XP</span>
                  <span>{report.sessions}回目の診察</span>
                </div>
              </div>
            </div>

            {/* Learning Plan */}
            {report.learningPlan && (
              <div className="bg-drd-bg rounded-xl border border-[#30363d] px-4 py-4 mb-5">
                <h3 className="text-xs font-bold text-[#8b949e] mb-2">💊 学習プラン</h3>
                {report.learningPlan.split("\n").filter(Boolean).map((l, i) => (
                  <p
                    key={i}
                    className={`text-sm leading-relaxed mb-1.5 ${
                      l.startsWith("📌") ? "text-drd-amber font-medium" : "text-[#8b949e]"
                    }`}
                  >
                    {l}
                  </p>
                ))}
              </div>
            )}

            <button
              className="w-full bg-drd-amber hover:bg-drd-amber/90 text-drd-bg font-bold py-3.5 rounded-xl transition-colors"
              onClick={reset}
            >
              もういちど診察する 🔄
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
