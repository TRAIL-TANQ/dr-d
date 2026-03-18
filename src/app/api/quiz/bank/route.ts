import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * GET /api/quiz/bank?textbook=体系数学1&chapter=正の数・負の数&section=加法・減法&difficulty=3&count=5
 *
 * times_used が少ないものを優先してランダムに取得。
 * 取得した問題の times_used をインクリメント。
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const textbook = url.searchParams.get("textbook");
    const chapter = url.searchParams.get("chapter");
    const section = url.searchParams.get("section");
    const difficulty = url.searchParams.get("difficulty");
    const count = Math.min(parseInt(url.searchParams.get("count") ?? "5", 10), 20);

    if (!textbook || !chapter) {
      return NextResponse.json({ error: "textbook and chapter are required" }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from("questions")
      .select("id, q, choices, answer, hint, explanation, difficulty, times_used")
      .eq("textbook", textbook)
      .eq("chapter", chapter)
      .order("times_used", { ascending: true })
      .limit(count * 3); // fetch extra for randomization

    if (section) query = query.eq("section", section);
    if (difficulty) query = query.eq("difficulty", parseInt(difficulty, 10));

    const { data, error } = await query;

    if (error) {
      console.error("bank query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ questions: [], source: "bank", count: 0 });
    }

    // Shuffle and pick `count` questions, preferring lower times_used
    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, count);

    // Increment times_used for selected questions
    const ids = shuffled.map((q) => q.id);
    supabase.rpc("increment_times_used", { question_ids: ids }).then(({ error: rpcErr }) => {
      if (rpcErr) console.error("increment_times_used error:", rpcErr);
    });

    // Format response to match QuizQuestion interface
    const questions = shuffled.map((q) => {
      const answerIdx = (q.choices as string[]).indexOf(q.answer as string);
      return {
        id: q.id,
        q: q.q,
        choices: q.choices as string[],
        answer: answerIdx === -1 ? 0 : answerIdx,
        hint: q.hint ?? "",
        explanation: q.explanation ?? "",
      };
    });

    return NextResponse.json({ questions, source: "bank", count: questions.length });
  } catch (e) {
    console.error("bank error:", e);
    return NextResponse.json({ error: "問題バンクの取得に失敗しました" }, { status: 500 });
  }
}
