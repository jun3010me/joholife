export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'single-choice' | 'fill-in-blank' | 'true-false';
  title: string;
  description: string;
  options: QuestionOption[];
  correctAnswer?: string; // For fill-in-blank questions
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  points: number;
  hint?: string;
  imageUrl?: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // in minutes
  questions: Question[];
  tags: string[];
  category: string;
}

export interface QuizSession {
  id: string;
  questionSetId: string;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<string, string | string[]>;
  score: number;
  maxScore: number;
  startTime: Date;
  endTime?: Date;
  isCompleted: boolean;
}

export interface QuizResult {
  sessionId: string;
  questionSetId: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  maxScore: number;
  percentage: number;
  timeSpent: number; // in seconds
  completedAt: Date;
  incorrectQuestions: Question[];
}

export interface UserProgress {
  userId: string;
  questionSetId: string;
  bestScore: number;
  totalAttempts: number;
  averageScore: number;
  lastAttempt: Date;
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface QuizState {
  currentSession: QuizSession | null;
  isLoading: boolean;
  error: string | null;
  progress: Record<string, UserProgress>;
}