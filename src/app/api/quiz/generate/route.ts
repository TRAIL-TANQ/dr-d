import { NextResponse } from "next/server";
import { callClaude, parseQuizJSON, QUIZ_JSON_INSTRUCTION } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const { name, grade, topic, subtopic } = await req.json();

    if (!name || !grade || !topic || !subtopic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const system = [
      `あなたはDr.D、学習診断AI博士。`,
      `生徒「${name}」（${grade}）の理解度チェック用クイズを5問作って。`,
      `科目:${topic}、範囲:${subtopic}、学年:${grade}。基礎レベル中心。`,
      QUIZ_JSON_INSTRUCTION,
      `5問ちょうど。`,
    ].join("");

    const raw = await callClaude(system, `科目:${topic} 範囲:${subtopic}`);
    const questions = parseQuizJSON(raw);

    return NextResponse.json({ questions: questions.slice(0, 5) });
  } catch (e) {
    console.error("quiz/generate error:", e);
    return NextResponse.json(
      { error: "問題の生成に失敗しました。もう一度お試しください。" },
      { status: 500 },
    );
  }
}
