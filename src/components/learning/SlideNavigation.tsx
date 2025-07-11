import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Clock, CheckCircle, Home } from 'lucide-react';
import { useLearningStore } from '../../stores/learningStore';
import { motion } from 'framer-motion';

interface SlideNavigationProps {
  chapter: string;
  currentSlide: number;
  totalSlides: number;
  title: string;
  onPrevious: () => void;
  onNext: () => void;
  estimatedTime?: number;
}

export const SlideNavigation: React.FC<SlideNavigationProps> = ({
  chapter,
  currentSlide,
  totalSlides,
  title,
  onPrevious,
  onNext,
  estimatedTime = 0,
}) => {
  const { 
    setCurrentChapter, 
    setCurrentSlide, 
    markSlideCompleted,
    getChapterProgress 
  } = useLearningStore();

  useEffect(() => {
    setCurrentChapter(chapter);
    setCurrentSlide(currentSlide);
  }, [chapter, currentSlide, setCurrentChapter, setCurrentSlide]);

  const handleNext = () => {
    markSlideCompleted(chapter, currentSlide, estimatedTime);
    onNext();
  };

  const progress = (currentSlide / totalSlides) * 100;
  const chapterProgress = getChapterProgress(chapter);

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentSlide > 1) {
      onPrevious();
    } else if (e.key === 'ArrowRight' && currentSlide < totalSlides) {
      handleNext();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [currentSlide, totalSlides]);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <motion.div
            className="bg-blue-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            <a
              href="/lessons"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Home size={20} />
              <span>レッスン一覧</span>
            </a>
            
            <div className="flex items-center space-x-2 text-gray-800">
              <BookOpen size={20} />
              <span className="font-medium">{title}</span>
            </div>
          </div>

          {/* Center section - slide info */}
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              スライド {currentSlide} / {totalSlides}
            </div>
            
            {estimatedTime > 0 && (
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <Clock size={16} />
                <span>{estimatedTime}分</span>
              </div>
            )}
            
            <div className="flex items-center space-x-1 text-sm text-green-600">
              <CheckCircle size={16} />
              <span>{Math.round(chapterProgress)}%完了</span>
            </div>
          </div>

          {/* Right section - navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onPrevious}
              disabled={currentSlide <= 1}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              <span>前へ</span>
            </button>
            
            <button
              onClick={handleNext}
              disabled={currentSlide >= totalSlides}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span>次へ</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};