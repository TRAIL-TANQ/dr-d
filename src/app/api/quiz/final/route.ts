import { NextResponse } from "next/server";
import { callClaude, parseQuizJSON, QUIZ_JSON_INSTRUCTION } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const { name, grade, topic, quizScore, plan } = await req.json();

    if (!name || !grade || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const system = [
      `あなたはDr.D。`,
      `生徒「${name}」（${grade}）の最終確認3問。`,
      `科目:${topic}、正答率${quizScore ?? 0}/10。`,
      `間違えた部分中心に。`,
      QUIZ_JSON_INSTRUCTION,
      ` 3問ちょうど。`,
    ].join("");

    const raw = await callClaude(system, `学習提案:${plan ?? ""}`);
    const questions = parseQuizJSON(raw);

    return NextResponse.json({ questions: questions.slice(0, 3) });
  } catch (e) {
    console.error("quiz/final error:", e);
    return NextResponse.json(
      { error: "問題の生成に失敗しました。もう一度お試しください。" },
      { status: 500 },
    );
  }
}
