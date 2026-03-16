export interface QuizQuestion {
  q: string;
  choices: string[];
  answer: number;
  hint: string;
  explanation: string;
}

export interface SessionResult {
  selected: number | null;
  correct: boolean;
  skipped: boolean;
}

export interface Profile {
  id?: string;
  name: string;
  grade: string;
  xp: number;
  sessions: number;
  lastDate?: string;
}

export interface HistoryEntry {
  id?: string;
  date: string;
  topic: string;
  subtopic: string;
  grade: string;
  difficulty: number;
  quizScore: number;
  finalScore: number;
  assessScore: number;
  xpEarned: number;
}

export interface Report {
  name: string;
  grade: string;
  topic: string;
  subtopic: string;
  difficulty: number;
  date: string;
  quizScore: number;
  assessScore: number;
  finalScore: number;
  totalXP: number;
  totalXPAll: number;
  sessions: number;
  learningPlan: string;
  level: { level: number; cur: number; next: number };
}
