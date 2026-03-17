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

// ---------- 教科書定義 ----------
interface TextbookDef {
  textbook: string;
  subject: "math" | "english" | "science" | "geography" | "history" | "world_history" | "elem_math";
  chapters: { chapter: string; sections: string[] }[];
}

const ALL_TEXTBOOKS: TextbookDef[] = [
  {
    textbook: "体系数学1",
    subject: "math",
    chapters: [
      { chapter: "正の数・負の数", sections: ["正負の数の意味", "加法・減法", "乗法・除法", "四則混合"] },
      { chapter: "文字と式", sections: ["文字式の表し方", "文字式の計算", "式の値"] },
      { chapter: "一次方程式", sections: ["等式と方程式", "一次方程式の解き方", "一次方程式の利用"] },
      { chapter: "不等式", sections: ["不等式の性質", "一次不等式の解き方"] },
      { chapter: "比例と反比例", sections: ["比例", "反比例", "比例と反比例の利用"] },
      { chapter: "平面図形", sections: ["基本の作図", "図形の移動", "おうぎ形"] },
      { chapter: "空間図形", sections: ["立体の種類", "展開図と投影図", "体積と表面積"] },
      { chapter: "データの分析", sections: ["度数分布", "代表値", "データの散らばり"] },
    ],
  },
  {
    textbook: "体系数学2",
    subject: "math",
    chapters: [
      { chapter: "式の計算", sections: ["多項式の計算", "単項式の乗除", "式の利用"] },
      { chapter: "連立方程式", sections: ["連立方程式の解き方", "連立方程式の利用"] },
      { chapter: "一次関数", sections: ["一次関数とグラフ", "方程式とグラフ", "一次関数の利用"] },
      { chapter: "平行と合同", sections: ["角と平行線", "三角形の合同", "証明"] },
      { chapter: "三角形と四角形", sections: ["二等辺三角形", "直角三角形", "平行四辺形"] },
      { chapter: "確率", sections: ["場合の数", "確率の求め方", "確率の利用"] },
      { chapter: "データの活用", sections: ["四分位範囲", "箱ひげ図", "標本調査"] },
    ],
  },
  {
    textbook: "NEW CROWN 1",
    subject: "english",
    chapters: [
      { chapter: "be動詞", sections: ["I am / You are / This is"] },
      { chapter: "一般動詞", sections: ["肯定文", "否定文", "疑問文"] },
      { chapter: "疑問詞", sections: ["What/Who", "Where/When", "How"] },
      { chapter: "名詞・代名詞", sections: ["複数形", "人称代名詞", "所有格"] },
      { chapter: "現在進行形", sections: ["肯定文", "否定文", "疑問文"] },
      { chapter: "過去形", sections: ["規則動詞", "不規則動詞", "was・were"] },
      { chapter: "canの文", sections: ["肯定文", "否定文", "疑問文"] },
    ],
  },
  {
    textbook: "中学理科1",
    subject: "science",
    chapters: [
      { chapter: "植物の世界", sections: ["花のつくり", "根・茎・葉のつくり", "光合成と呼吸", "植物の分類"] },
      { chapter: "物質の性質", sections: ["身のまわりの物質", "気体の性質", "水溶液の性質", "物質の状態変化"] },
      { chapter: "光・音・力", sections: ["光の反射と屈折", "凸レンズ", "音の性質", "力のはたらき", "圧力"] },
      { chapter: "大地の変化", sections: ["火山", "地震", "地層と堆積岩", "大地の変動"] },
    ],
  },
  {
    textbook: "中学理科2",
    subject: "science",
    chapters: [
      { chapter: "化学変化と原子・分子", sections: ["物質の分解", "原子と分子", "化学反応式", "酸化と還元", "化学変化と質量"] },
      { chapter: "動物の世界", sections: ["細胞", "消化と吸収", "呼吸と循環", "感覚と運動", "動物の分類"] },
      { chapter: "電流とその利用", sections: ["回路と電流・電圧", "オームの法則", "電力と熱量", "電流と磁界"] },
      { chapter: "天気の変化", sections: ["気象観測", "大気圧と風", "前線と天気の変化", "日本の天気"] },
    ],
  },
  {
    textbook: "中学地理",
    subject: "geography",
    chapters: [
      { chapter: "世界の姿", sections: ["地球の姿", "世界の国々", "緯度と経度", "地図の見方"] },
      { chapter: "世界の諸地域", sections: ["アジア", "ヨーロッパ", "アフリカ", "北アメリカ", "南アメリカ", "オセアニア"] },
      { chapter: "日本の姿", sections: ["日本の位置と領域", "都道府県", "日本の地形", "日本の気候"] },
      { chapter: "日本の諸地域", sections: ["九州", "中国・四国", "近畿", "中部", "関東", "東北・北海道"] },
    ],
  },
  {
    textbook: "中学歴史",
    subject: "history",
    chapters: [
      { chapter: "古代文明と日本", sections: ["人類の出現", "古代文明", "縄文・弥生時代", "古墳時代"] },
      { chapter: "古代国家", sections: ["飛鳥時代", "奈良時代", "平安時代", "国風文化"] },
      { chapter: "中世", sections: ["鎌倉幕府", "元寇", "室町幕府", "室町文化", "戦国時代"] },
      { chapter: "近世", sections: ["織田信長・豊臣秀吉", "江戸幕府の成立", "鎖国", "元禄文化", "化政文化", "幕末"] },
      { chapter: "近代", sections: ["明治維新", "自由民権運動", "日清・日露戦争", "大正デモクラシー"] },
      { chapter: "二つの世界大戦", sections: ["第一次世界大戦", "世界恐慌", "第二次世界大戦", "太平洋戦争"] },
      { chapter: "現代", sections: ["戦後改革", "高度経済成長", "冷戦", "現代の日本と世界"] },
    ],
  },
  {
    textbook: "高校世界史",
    subject: "world_history",
    chapters: [
      { chapter: "古代オリエントとギリシア", sections: ["メソポタミア", "エジプト", "ギリシアのポリス", "ヘレニズム"] },
      { chapter: "ローマと古代インド・中国", sections: ["ローマ帝国", "インド文明", "中国の統一王朝", "秦・漢"] },
      { chapter: "イスラーム世界", sections: ["イスラームの成立", "ウマイヤ朝・アッバース朝", "オスマン帝国"] },
      { chapter: "中世ヨーロッパ", sections: ["フランク王国", "封建制度", "十字軍", "ルネサンス", "宗教改革"] },
      { chapter: "近世ヨーロッパ", sections: ["大航海時代", "絶対王政", "市民革命", "産業革命"] },
      { chapter: "帝国主義と二つの世界大戦", sections: ["帝国主義", "第一次世界大戦", "ロシア革命", "第二次世界大戦"] },
      { chapter: "現代世界", sections: ["冷戦", "植民地の独立", "グローバル化", "21世紀の課題"] },
    ],
  },
  {
    textbook: "小学算数4年",
    subject: "elem_math",
    chapters: [
      { chapter: "大きな数", sections: ["億・兆の位", "数のしくみ"] },
      { chapter: "わり算", sections: ["2けた÷1けた", "3けた÷2けた", "あまりのあるわり算"] },
      { chapter: "角と図形", sections: ["角度", "垂直と平行", "台形・平行四辺形"] },
      { chapter: "小数", sections: ["小数のたし算・ひき算", "小数×整数", "小数÷整数"] },
      { chapter: "分数", sections: ["分数の大きさ", "同分母のたし算・ひき算"] },
      { chapter: "面積", sections: ["長方形・正方形の面積", "複合図形の面積"] },
      { chapter: "がい数", sections: ["四捨五入", "概算"] },
      { chapter: "変わり方とグラフ", sections: ["折れ線グラフ", "表の整理"] },
    ],
  },
  {
    textbook: "小学算数5年",
    subject: "elem_math",
    chapters: [
      { chapter: "整数と小数", sections: ["十進法", "小数の位"] },
      { chapter: "小数のかけ算・わり算", sections: ["小数×小数", "小数÷小数"] },
      { chapter: "分数", sections: ["約分・通分", "異分母のたし算・ひき算", "分数と小数"] },
      { chapter: "図形の面積", sections: ["三角形", "平行四辺形", "台形", "ひし形"] },
      { chapter: "体積", sections: ["直方体・立方体", "容積"] },
      { chapter: "割合", sections: ["割合の意味", "百分率", "歩合", "帯グラフ・円グラフ"] },
      { chapter: "平均と単位量あたり", sections: ["平均", "単位量あたりの大きさ", "速さ"] },
      { chapter: "合同と角", sections: ["合同な図形", "三角形の角", "多角形の角"] },
    ],
  },
  {
    textbook: "小学算数6年",
    subject: "elem_math",
    chapters: [
      { chapter: "分数のかけ算・わり算", sections: ["分数×分数", "分数÷分数", "逆数"] },
      { chapter: "比と比の値", sections: ["比の意味", "等しい比", "比の利用"] },
      { chapter: "円の面積", sections: ["円の面積", "複合図形"] },
      { chapter: "対称な図形", sections: ["線対称", "点対称"] },
      { chapter: "拡大と縮小", sections: ["拡大図・縮図", "縮尺"] },
      { chapter: "速さ", sections: ["速さの求め方", "道のり・時間の求め方"] },
      { chapter: "比例と反比例", sections: ["比例", "反比例", "グラフ"] },
      { chapter: "データの調べ方", sections: ["ドットプロット", "度数分布表", "代表値"] },
    ],
  },
];

// CLIから教科書名を指定可能: npx tsx scripts/generate-questions.ts "体系数学2"
const targetTextbook = process.argv[2];
const TEXTBOOKS_TO_GENERATE = targetTextbook
  ? ALL_TEXTBOOKS.filter((t) => t.textbook === targetTextbook)
  : ALL_TEXTBOOKS;

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
  textbook: string,
  subject: TextbookDef["subject"],
  chapter: string,
  section: string,
  difficulty: number,
): Promise<GeneratedQuestion[]> {
  const subjectLabels: Record<TextbookDef["subject"], string> = {
    math: "中学数学", english: "中学英語", science: "中学理科", geography: "中学社会・地理",
    history: "中学歴史", world_history: "高校世界史", elem_math: "小学算数",
  };
  const subjectLabel = subjectLabels[subject];
  const system = [
    `あなたは${subjectLabel}の問題作成の専門家です。`,
    `教科書「${textbook}」の「${chapter}」章、「${section}」の範囲で問題を3問作成してください。`,
    `難易度: ${difficulty}/5（${DIFF_LABELS[difficulty]}）`,
    `\n`,
    `JSON配列のみ返してください。余計なテキストは不要です:`,
    `[{"q":"問題文","choices":["選択肢A","選択肢B","選択肢C"],"answer":0,"hint":"ヒント1文","explanation":"解説2〜3文"}]`,
    `\n`,
    `ルール:`,
    `- answerは正解の選択肢のindex(0,1,2)`,
    `- 3択（choices配列は必ず3要素）`,
    subject === "math" || subject === "elem_math" ? `- 問題文に数式がある場合はプレーンテキストで表記`
      : subject === "english" ? `- 英語の問題は日本語で出題し、選択肢に英語を含める`
      : `- 問題文は日本語で、用語や概念を正確に出題すること`,
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
        content: `${textbook}「${chapter}」→「${section}」難易度${difficulty} の問題を3問、JSON配列で。`,
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

// ---------- 選択肢シャッフル ----------
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  if (TEXTBOOKS_TO_GENERATE.length === 0) {
    console.error(`❌ 教科書「${targetTextbook}」が見つかりません。`);
    process.exit(1);
  }

  for (const tbDef of TEXTBOOKS_TO_GENERATE) {
    const { textbook, subject, chapters } = tbDef;
    const totalSections = chapters.reduce((sum: number, ch) => sum + ch.sections.length, 0);
    const totalBatches = totalSections * 5;
    let completed = 0;
    let totalInserted = 0;

    console.log(`\n🧬 Dr.D 問題バンク生成`);
    console.log(`📚 教科書: ${textbook}`);
    console.log(`📖 ${chapters.length}章 ${totalSections}節 × 難易度5段階 × 各3問`);
    console.log(`📊 合計予定: ${totalSections * 5 * 3}問`);
    console.log(`${"─".repeat(50)}\n`);

    for (let ci = 0; ci < chapters.length; ci++) {
      const { chapter, sections } = chapters[ci];
      console.log(`\n📖 第${ci + 1}章: ${chapter}`);

      for (const section of sections) {
        for (let diff = 1; diff <= 5; diff++) {
          completed++;
          const progress = `[${completed}/${totalBatches}]`;
          process.stdout.write(`  ${progress} ${section} (Lv.${diff})... `);

          try {
            const questions = await generateQuestions(textbook, subject, chapter, section, diff);
            const rows: DBRow[] = questions.map((q) => {
              const correctText = q.choices[q.answer] ?? q.choices[0];
              const shuffled = shuffleArray(q.choices);
              return {
              textbook,
              chapter,
              section,
              difficulty: diff,
              q: q.q,
              choices: shuffled,
              answer: correctText,
              hint: q.hint || null,
              explanation: q.explanation || null,
              times_used: 0,
              correct_rate: 0,
            };
            });

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
    console.log(`✨ ${textbook} 完了！ 合計 ${totalInserted}問 を挿入しました。\n`);
  }
}

main().catch((err) => {
  console.error("致命的エラー:", err);
  process.exit(1);
});
