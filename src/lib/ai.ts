import Anthropic from "@anthropic-ai/sdk";
import type { QuizQuestion } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const QUIZ_JSON_INSTRUCTION =
  'JSON形式のみ返してください: [{"q":"問題文","choices":["選択肢A","選択肢B","選択肢C"],"answer":0,"hint":"ヒント1文","explanation":"解説2〜3文"}] answerは正解index(0,1,2)。';

export async function callClaude(system: string, user: string): Promise<string> {
  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
}

export function parseQuizJSON(raw: string): QuizQuestion[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  // Try to find JSON array in the response
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("No JSON array found in AI response");
  }
  return JSON.parse(match[0]);
}

export { QUIZ_JSON_INSTRUCTION };
