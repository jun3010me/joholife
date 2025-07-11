import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LearningProgress {
  chapter: string;
  slide: number;
  completed: boolean;
  lastAccessed: Date;
  timeSpent: number;
}

interface QuizResult {
  chapterId: string;
  slideId: string;
  score: number;
  attempts: number;
  lastAttempt: Date;
}

interface LearningState {
  // Progress tracking
  progress: Record<string, LearningProgress>;
  quizResults: QuizResult[];
  currentChapter: string | null;
  currentSlide: number;
  
  // Actions
  setCurrentChapter: (chapter: string) => void;
  setCurrentSlide: (slide: number) => void;
  markSlideCompleted: (chapter: string, slide: number, timeSpent: number) => void;
  addQuizResult: (result: QuizResult) => void;
  getProgress: (chapter: string) => LearningProgress | undefined;
  getChapterProgress: (chapter: string) => number;
  getTotalProgress: () => number;
  resetProgress: () => void;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set, get) => ({
      progress: {},
      quizResults: [],
      currentChapter: null,
      currentSlide: 0,
      
      setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
      
      setCurrentSlide: (slide) => set({ currentSlide: slide }),
      
      markSlideCompleted: (chapter, slide, timeSpent) => {
        const key = `${chapter}-${slide}`;
        set((state) => ({
          progress: {
            ...state.progress,
            [key]: {
              chapter,
              slide,
              completed: true,
              lastAccessed: new Date(),
              timeSpent: (state.progress[key]?.timeSpent || 0) + timeSpent,
            },
          },
        }));
      },
      
      addQuizResult: (result) => {
        set((state) => ({
          quizResults: [...state.quizResults, result],
        }));
      },
      
      getProgress: (chapter) => {
        const key = `${chapter}-${get().currentSlide}`;
        return get().progress[key];
      },
      
      getChapterProgress: (chapter) => {
        const chapterProgress = Object.values(get().progress).filter(
          (p) => p.chapter === chapter
        );
        if (chapterProgress.length === 0) return 0;
        const completed = chapterProgress.filter((p) => p.completed).length;
        return (completed / chapterProgress.length) * 100;
      },
      
      getTotalProgress: () => {
        const allProgress = Object.values(get().progress);
        if (allProgress.length === 0) return 0;
        const completed = allProgress.filter((p) => p.completed).length;
        return (completed / allProgress.length) * 100;
      },
      
      resetProgress: () => set({ progress: {}, quizResults: [] }),
    }),
    {
      name: 'learning-storage',
    }
  )
);