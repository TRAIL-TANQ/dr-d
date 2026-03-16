import { NextResponse } from "next/server";
import { callClaude } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const { name, grade, topic, difficulty, quizScore, details } = await req.json();

    if (!name || !grade || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const system = [
      `あなたはDr.D。`,
      `生徒「${name}」（${grade}）の結果から学習提案。`,
      `科目:${topic}、難易度${difficulty ?? 3}/5、正答率${quizScore ?? 0}/10。`,
      `励ましつつ学習ステップ3〜5つ。`,
      `「📌 ステップ名: 内容」形式。`,
      `最初に診断コメント2〜3文。プレーンテキスト。`,
    ].join("");

    const userMsg = details ? `結果:\n${details}` : `科目:${topic}`;

    const raw = await callClaude(system, userMsg);

    return NextResponse.json({ plan: raw });
  } catch (e) {
    console.error("plan error:", e);
    return NextResponse.json(
      { error: "学習プランの生成に失敗しました。もう一度お試しください。" },
      { status: 500 },
    );
  }
}
