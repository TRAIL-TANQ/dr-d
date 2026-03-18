import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const VERIFY_SYSTEM = `あなたは教育コンテンツの品質チェッカーです。以下の3択クイズが正しいか検証してください。
検証ポイント:
- 算数・数学: 実際に計算して正解を確認
- 英語: 文法・スペル・和訳の正確性を確認
- 理科: 科学的事実との整合性を確認
- 地理: 地理的事実の正確性を確認
- 歴史・世界史: 歴史的事実の正確性を確認
問題文、選択肢、正解が全て正しければis_valid: true。
誤りがあればis_valid: falseとし、何が間違っているか具体的に説明。
JSONのみで返してください: {"is_valid": true/false, "reason": "理由（日本語、1〜2文）"}`;

const MATH_SOLVE_SYSTEM = `この問題を実際にステップバイステップで解いてください。最終的な答えは何ですか？選択肢の中から正解を選んでください。JSONのみで返してください: {"calculated_answer": "...", "matches_given_answer": true/false}`;

function isMathTextbook(textbook: string): boolean {
  return textbook.includes("算数") || textbook.includes("数学");
}

async function verifyQuestion(
  textbook: string,
  q: string,
  choices: string[],
  answer: string,
): Promise<{ is_valid: boolean; reason: string }> {
  // Step 1: General verification
  const res1 = await anthropic.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 500,
    system: VERIFY_SYSTEM,
    messages: [{
      role: "user",
      content: `教科書: ${textbook}\n問題: ${q}\n選択肢: ${choices.map((c, i) => `${i + 1}.${c}`).join(" / ")}\n正解: ${answer}`,
    }],
  });

  const text1 = res1.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const match1 = text1.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
  if (!match1) return { is_valid: true, reason: "検証結果を解析できませんでした" };

  const result1 = JSON.parse(match1[0]) as { is_valid: boolean; reason: string };

  // If general check says invalid, return immediately
  if (!result1.is_valid) return result1;

  // Step 2: For math, solve it independently
  if (isMathTextbook(textbook)) {
    const res2 = await anthropic.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 1000,
      system: MATH_SOLVE_SYSTEM,
      messages: [{
        role: "user",
        content: `問題: ${q}\n選択肢: ${choices.map((c, i) => `${i + 1}.${c}`).join(" / ")}\n記載された正解: ${answer}`,
      }],
    });

    const text2 = res2.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const match2 = text2.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
    if (match2) {
      const result2 = JSON.parse(match2[0]) as { calculated_answer: string; matches_given_answer: boolean };
      if (!result2.matches_given_answer) {
        return {
          is_valid: false,
          reason: `計算検証で不一致。記載の正解: ${answer}、計算結果: ${result2.calculated_answer}`,
        };
      }
    }
  }

  return result1;
}

/**
 * POST /api/quiz/report
 * AI-powered real-time question verification
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question_id, reporter_name, report_type, comment } = body;

    if (!question_id || !reporter_name || !report_type) {
      return NextResponse.json(
        { error: "question_id, reporter_name, report_type are required" },
        { status: 400 },
      );
    }

    const validTypes = ["wrong_answer", "bad_question", "duplicate_choices", "other"];
    if (!validTypes.includes(report_type)) {
      return NextResponse.json(
        { error: `report_type must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // Rate limit: max 3 rejected reports per day per user
    const { data: rejectedToday } = await supabase
      .from("question_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_name", reporter_name)
      .eq("status", "rejected")
      .gte("created_at", new Date().toISOString().split("T")[0]);

    const rejectedCount = rejectedToday?.length ?? 0;
    if (rejectedCount >= 3) {
      return NextResponse.json({
        locked: true,
        message: "今日の報告上限に達しました",
        confirmed: false,
        xp: 0,
      });
    }

    // Check for duplicate report (same user + same question)
    const { data: existing } = await supabase
      .from("question_reports")
      .select("id")
      .eq("question_id", question_id)
      .eq("reporter_name", reporter_name)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "この問題はすでに報告済みです", duplicate: true, confirmed: false, xp: 0 },
        { status: 409 },
      );
    }

    // Fetch question data
    const { data: questionData, error: qErr } = await supabase
      .from("questions")
      .select("q, choices, answer, textbook")
      .eq("id", question_id)
      .single();

    if (qErr || !questionData) {
      return NextResponse.json({ error: "問題が見つかりません" }, { status: 404 });
    }

    // AI verification
    const verification = await verifyQuestion(
      questionData.textbook,
      questionData.q,
      questionData.choices as string[],
      questionData.answer,
    );

    const status = verification.is_valid ? "rejected" : "confirmed";
    const xpRewarded = !verification.is_valid;

    // Insert report
    const { error: insertErr } = await supabase.from("question_reports").insert({
      question_id,
      reporter_name,
      report_type,
      comment: comment?.trim() || null,
      status,
      xp_rewarded: xpRewarded,
      ai_reason: verification.reason,
    });

    if (insertErr) {
      console.error("report insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // If confirmed, flag the question
    if (!verification.is_valid) {
      await supabase
        .from("questions")
        .update({ is_flagged: true })
        .eq("id", question_id);
    }

    return NextResponse.json({
      confirmed: !verification.is_valid,
      xp: xpRewarded ? 100 : 0,
      reason: verification.reason,
    });
  } catch (e) {
    console.error("report error:", e);
    return NextResponse.json({ error: "検証に失敗しました" }, { status: 500 });
  }
}
