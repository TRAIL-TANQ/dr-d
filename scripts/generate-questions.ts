/**
 * 問題バンク一括生成スクリプト
 * 体系数学1（数研出版）中1 の全章・全節 × 難易度1〜5 × 各3問
 *
 * 実行: npx tsx scripts/generate-questions.ts
 * .env.local から ANTHROPIC_API_KEY と NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY を読み込む
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// ---------- 環境変数 ----------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ .env.local に ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- 体系数学1 章立て ----------
const TEXTBOOK = "体系数学1";

const CHAPTERS: { chapter: string; sections: string[] }[] = [
  {
    chapter: "正の数・負の数",
    sections: ["正負の数の意味", "加法・減法", "乗法・除法", "四則混合"],
  },
  {
    chapter: "文字と式",
    sections: ["文字式の表し方", "文字式の計算", "式の値"],
  },
  {
    chapter: "一次方程式",
    sections: ["等式と方程式", "一次方程式の解き方", "一次方程式の利用"],
  },
  {
    chapter: "不等式",
    sections: ["不等式の性質", "一次不等式の解き方"],
  },
  {
    chapter: "比例と反比例",
    sections: ["比例", "反比例", "比例と反比例の利用"],
  },
  {
    chapter: "平面図形",
    sections: ["基本の作図", "図形の移動", "おうぎ形"],
  },
  {
    chapter: "空間図形",
    sections: ["立体の種類", "展開図と投影図", "体積と表面積"],
  },
  {
    chapter: "データの分析",
    sections: ["度数分布", "代表値", "データの散らばり"],
  },
];

// ---------- 難易度ラベル ----------
const DIFF_LABELS: Record<number, string> = {
  1: "基礎（定義・用語の確認）",
  2: "標準（教科書の例題レベル）",
  3: "やや応用（練習問題レベル）",
  4: "応用（章末問題レベル）",
  5: "発展（入試レベル）",
};

// ---------- 問題生成 ----------
interface GeneratedQuestion {
  q: string;
  choices: string[];
  answer: number;
  hint: string;
  explanation: string;
}

async function generateQuestions(
  chapter: string,
  section: string,
  difficulty: number,
): Promise<GeneratedQuestion[]> {
  const system = [
    `あなたは中学数学の問題作成の専門家です。`,
    `教科書「${TEXTBOOK}」（数研出版）の「${chapter}」章、「${section}」の範囲で問題を3問作成してください。`,
    `難易度: ${difficulty}/5（${DIFF_LABELS[difficulty]}）`,
    `\n`,
    `JSON配列のみ返してください。余計なテキストは不要です:`,
    `[{"q":"問題文","choices":["選択肢A","選択肢B","選択肢C"],"answer":0,"hint":"ヒント1文","explanation":"解説2〜3文"}]`,
    `\n`,
    `ルール:`,
    `- answerは正解の選択肢のindex(0,1,2)`,
    `- 3択（choices配列は必ず3要素）`,
    `- 問題文に数式がある場合はプレーンテキストで表記`,
    `- 3問ちょうど生成すること`,
    `- 同じパターンの問題を避け、バリエーションを持たせること`,
  ].join("\n");

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system,
    messages: [
      {
        role: "user",
        content: `${TEXTBOOK}「${chapter}」→「${section}」難易度${difficulty} の問題を3問、JSON配列で。`,
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`JSON解析失敗: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

// ---------- DB挿入 ----------
interface DBRow {
  textbook: string;
  chapter: string;
  section: string;
  difficulty: number;
  q: string;
  choices: string[];
  answer: string;
  hint: string | null;
  explanation: string | null;
  times_used: number;
  correct_rate: number;
}

async function insertQuestions(rows: DBRow[]) {
  const { error } = await supabase.from("questions").insert(rows);
  if (error) throw new Error(`Supabase挿入エラー: ${error.message}`);
}

// ---------- メイン ----------
async function main() {
  const totalSections = CHAPTERS.reduce((sum, ch) => sum + ch.sections.length, 0);
  const totalBatches = totalSections * 5; // 5 difficulty levels
  let completed = 0;
  let totalInserted = 0;

  console.log(`\n🧬 Dr.D 問題バンク生成`);
  console.log(`📚 教科書: ${TEXTBOOK}`);
  console.log(`📖 ${CHAPTERS.length}章 ${totalSections}節 × 難易度5段階 × 各3問`);
  console.log(`📊 合計予定: ${totalSections * 5 * 3}問`);
  console.log(`${"─".repeat(50)}\n`);

  for (const { chapter, sections } of CHAPTERS) {
    console.log(`\n📖 第${CHAPTERS.findIndex((c) => c.chapter === chapter) + 1}章: ${chapter}`);

    for (const section of sections) {
      for (let diff = 1; diff <= 5; diff++) {
        completed++;
        const progress = `[${completed}/${totalBatches}]`;
        process.stdout.write(`  ${progress} ${section} (Lv.${diff})... `);

        try {
          const questions = await generateQuestions(chapter, section, diff);
          const rows: DBRow[] = questions.map((q) => ({
            textbook: TEXTBOOK,
            chapter,
            section,
            difficulty: diff,
            q: q.q,
            choices: q.choices,
            answer: q.choices[q.answer] ?? q.choices[0],
            hint: q.hint || null,
            explanation: q.explanation || null,
            times_used: 0,
            correct_rate: 0,
          }));

          await insertQuestions(rows);
          totalInserted += rows.length;
          console.log(`✅ ${rows.length}問`);
        } catch (err) {
          console.log(`❌ エラー: ${err instanceof Error ? err.message : err}`);
        }

        // レート制限対策: 1秒待機
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✨ 完了！ 合計 ${totalInserted}問 を questions テーブルに挿入しました。\n`);
}

main().catch((err) => {
  console.error("致命的エラー:", err);
  process.exit(1);
});
