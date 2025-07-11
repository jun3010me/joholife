import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Home, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Slide {
  id: number;
  title: string;
  content: React.ReactNode;
}

interface SlidePlayerProps {
  slides: Slide[];
  chapter: string;
  lessonTitle: string;
  onComplete?: () => void;
}

export const SlidePlayer: React.FC<SlidePlayerProps> = ({
  slides,
  chapter,
  lessonTitle,
  onComplete
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(currentSlide + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    if (index !== currentSlide) {
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    }
  };

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToSlide(slides.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, slides.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className="slide-player">
      {/* ヘッダー */}
      <header className="slide-header">
        <div className="header-content">
          <div className="header-left">
            <a href="/lessons" className="nav-btn">
              <Home size={20} />
              <span>レッスン一覧</span>
            </a>
            <div className="lesson-info">
              <BookOpen size={20} />
              <span>{lessonTitle}</span>
            </div>
          </div>
          
          <div className="header-center">
            <span className="slide-counter">
              {currentSlide + 1} / {slides.length}
            </span>
          </div>
          
          <div className="header-right">
            <button onClick={() => goToSlide(0)} className="nav-btn" disabled={currentSlide === 0}>
              <SkipBack size={20} />
            </button>
            <button onClick={prevSlide} className="nav-btn" disabled={currentSlide === 0}>
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextSlide} className="nav-btn primary">
              {currentSlide === slides.length - 1 ? '完了' : '次へ'}
              <ChevronRight size={20} />
            </button>
            <button 
              onClick={() => goToSlide(slides.length - 1)} 
              className="nav-btn" 
              disabled={currentSlide === slides.length - 1}
            >
              <SkipForward size={20} />
            </button>
          </div>
        </div>
        
        {/* プログレスバー */}
        <div className="progress-container">
          <motion.div
            className="progress-bar"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      {/* スライドエリア */}
      <main className="slide-main">
        <div className="slide-container">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="slide-content"
            >
              <div className="slide-inner">
                {slides[currentSlide]?.content}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* フッター */}
      <footer className="slide-footer">
        <div className="footer-content">
          <div className="slide-thumbnails">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`thumbnail ${index === currentSlide ? 'active' : ''}`}
                title={slide.title}
              >
                <div className="thumbnail-number">{index + 1}</div>
                <div className="thumbnail-title">{slide.title}</div>
              </button>
            ))}
          </div>
          
          <div className="keyboard-hints">
            <span>🌟 キーボードショートカット: ← → スペース</span>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .slide-player {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
          font-family: 'Inter', 'Noto Sans JP', sans-serif;
        }

        /* ヘッダー */
        .slide-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          z-index: 10;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
          height: 4rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          background: white;
          color: #64748b;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .nav-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nav-btn.primary {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .nav-btn.primary:hover:not(:disabled) {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }

        .lesson-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #374151;
          font-weight: 500;
        }

        .slide-counter {
          background: #f1f5f9;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #475569;
        }

        .progress-container {
          height: 4px;
          background: #e2e8f0;
          position: relative;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #06b6d4);
        }

        /* メインエリア */
        .slide-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }

        .slide-container {
          width: 100%;
          max-width: 900px;
          height: 100%;
          position: relative;
        }

        .slide-content {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .slide-inner {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
          padding: 3rem;
          width: 100%;
          max-height: 100%;
          overflow-y: auto;
        }

        /* フッター */
        .slide-footer {
          background: white;
          border-top: 1px solid #e2e8f0;
          padding: 1rem;
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .slide-thumbnails {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding: 0.5rem 0;
        }

        .thumbnail {
          min-width: 120px;
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .thumbnail:hover {
          border-color: #3b82f6;
          background: #f0f9ff;
        }

        .thumbnail.active {
          border-color: #3b82f6;
          background: #3b82f6;
          color: white;
        }

        .thumbnail-number {
          font-size: 0.75rem;
          font-weight: 600;
          opacity: 0.8;
        }

        .thumbnail-title {
          font-size: 0.75rem;
          margin-top: 0.25rem;
          line-height: 1.3;
        }

        .keyboard-hints {
          color: #64748b;
          font-size: 0.875rem;
          white-space: nowrap;
        }

        /* レスポンシブ */
        @media (max-width: 768px) {
          .header-content {
            padding: 0 0.5rem;
          }

          .header-left .lesson-info span {
            display: none;
          }

          .slide-main {
            padding: 1rem;
          }

          .slide-inner {
            padding: 2rem 1.5rem;
          }

          .slide-thumbnails {
            display: none;
          }

          .keyboard-hints {
            font-size: 0.75rem;
          }
        }

        /* スライドコンテンツのスタイル */
        .slide-inner :global(h1) {
          font-size: 2.5rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 2rem;
          text-align: center;
          border-bottom: 4px solid #3b82f6;
          padding-bottom: 1rem;
        }

        .slide-inner :global(h2) {
          font-size: 1.75rem;
          font-weight: 600;
          color: #1f2937;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }

        .slide-inner :global(h3) {
          font-size: 1.25rem;
          font-weight: 600;
          color: #374151;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .slide-inner :global(p) {
          color: #374151;
          line-height: 1.7;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }

        .slide-inner :global(ul) {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }

        .slide-inner :global(li) {
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }

        .slide-inner :global(strong) {
          color: #111827;
          font-weight: 600;
        }

        .slide-inner :global(code) {
          background: #f1f5f9;
          color: #e11d48;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.9em;
        }

        .slide-inner :global(pre) {
          background: #1e293b;
          color: #f1f5f9;
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 1rem 0;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};