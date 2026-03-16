import { NextResponse } from "next/server";
import { callClaude, parseQuizJSON, QUIZ_JSON_INSTRUCTION } from "@/lib/ai";

const DIFF_LABELS = ["かんたん", "ふつう", "ちょっとむずかしい", "むずかしい（応用）", "超むずかしい（発展）"];

export async function POST(req: Request) {
  try {
    const { name, grade, topic, subtopic, difficulty, assessScore, assessContext } = await req.json();

    if (!name || !grade || !topic || !subtopic || !difficulty) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const diffLabel = DIFF_LABELS[(difficulty as number) - 1] ?? "ふつう";

    const system = [
      `あなたはDr.D。`,
      `生徒「${name}」（${grade}）の本番診断クイズ10問作成。`,
      `科目:${topic}、範囲:${subtopic}、学年:${grade}、`,
      `難易度:${difficulty}/5（${diffLabel}）、`,
      `理解度チェック:${assessScore ?? 0}/5問正解。`,
      QUIZ_JSON_INSTRUCTION,
      ` 10問ちょうど。`,
    ].join("");

    const userMsg = assessContext
      ? `理解度チェック:\n${assessContext}`
      : `科目:${topic} 範囲:${subtopic}`;

    const raw = await callClaude(system, userMsg);
    const questions = parseQuizJSON(raw);

    return NextResponse.json({ questions: questions.slice(0, 10) });
  } catch (e) {
    console.error("quiz/main error:", e);
    return NextResponse.json(
      { error: "問題の生成に失敗しました。もう一度お試しください。" },
      { status: 500 },
    );
  }
}
