import { useState } from 'react';
import type { Question } from '../../types/question';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | string[] | null;
  onAnswerSelect: (answer: string | string[]) => void;
  onNext: () => void;
  onPrevious: () => void;
  showPrevious: boolean;
  showNext: boolean;
  isAnswered: boolean;
  showExplanation?: boolean;
}

const QuestionCard = ({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onAnswerSelect,
  onNext,
  onPrevious,
  showPrevious,
  showNext,
  isAnswered,
  showExplanation = false
}) => {
  const [showHint, setShowHint] = useState(false);

  const handleOptionClick = (optionId: string) => {
    if (question.type === 'multiple-choice') {
      const currentAnswers = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      const newAnswers = currentAnswers.includes(optionId)
        ? currentAnswers.filter(id => id !== optionId)
        : [...currentAnswers, optionId];
      onAnswerSelect(newAnswers);
    } else {
      onAnswerSelect(optionId);
    }
  };

  const isOptionSelected = (optionId: string) => {
    if (Array.isArray(selectedAnswer)) {
      return selectedAnswer.includes(optionId);
    }
    return selectedAnswer === optionId;
  };

  const getOptionStyle = (optionId: string, isCorrect: boolean) => {
    const isSelected = isOptionSelected(optionId);
    
    if (showExplanation) {
      if (isCorrect) {
        return 'bg-green-50 border-green-200 text-green-800';
      } else if (isSelected && !isCorrect) {
        return 'bg-red-50 border-red-200 text-red-800';
      } else {
        return 'bg-gray-50 border-gray-200 text-gray-600';
      }
    }
    
    if (isSelected) {
      return 'bg-blue-50 border-blue-200 text-blue-800';
    }
    
    return 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '初級';
      case 'medium':
        return '中級';
      case 'hard':
        return '上級';
      default:
        return '中級';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-bold">
              問題 {questionNumber}
            </span>
            <span className="text-blue-100">
              / {totalQuestions}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(question.difficulty)}`}>
              {getDifficultyText(question.difficulty)}
            </span>
            <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
              {question.points}点
            </span>
          </div>
        </div>
        
        <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
          <div 
            className="bg-white h-2 rounded-full transition-all duration-300"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question Content */}
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          {question.title}
        </h3>
        
        <div className="text-gray-600 mb-6 leading-relaxed">
          {question.description}
        </div>

        {question.imageUrl && (
          <div className="mb-6">
            <img
              src={question.imageUrl}
              alt="問題の図"
              className="max-w-full h-auto rounded-lg shadow-md"
            />
          </div>
        )}

        {/* Options */}
        <div className="space-y-3 mb-6">
          {question.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.id)}
              disabled={showExplanation}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 ${getOptionStyle(option.id, option.isCorrect)} ${
                showExplanation ? 'cursor-default' : 'cursor-pointer hover:shadow-md'
              }`}
            >
              <div className="flex items-center">
                <div className="mr-3">
                  {question.type === 'multiple-choice' ? (
                    <div className={`w-5 h-5 rounded border-2 ${
                      isOptionSelected(option.id) 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {isOptionSelected(option.id) && (
                        <svg className="w-3 h-3 text-white m-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      isOptionSelected(option.id) 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {isOptionSelected(option.id) && (
                        <div className="w-2 h-2 bg-white rounded-full m-1"></div>
                      )}
                    </div>
                  )}
                </div>
                <span className="flex-1">{option.text}</span>
                {showExplanation && option.isCorrect && (
                  <div className="ml-2 text-green-600">
                    <svg style={{width: '20px', height: '20px'}} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-800 mb-2">解説</h4>
            <p className="text-blue-700 leading-relaxed">{question.explanation}</p>
          </div>
        )}

        {/* Hint */}
        {question.hint && !showExplanation && (
          <div className="mb-6">
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center text-yellow-600 hover:text-yellow-700 transition-colors"
            >
              <svg style={{width: '20px', height: '20px', marginRight: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              ヒント
            </button>
            {showHint && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm">{question.hint}</p>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {question.tags.map((tag, index) => (
              <span
                key={index}
                className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={onPrevious}
            disabled={!showPrevious}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
              showPrevious
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg style={{width: '20px', height: '20px', marginRight: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            前の問題
          </button>

          {question.type === 'multiple-choice' && (
            <div className="text-sm text-gray-500">
              複数選択可能
            </div>
          )}

          <button
            onClick={onNext}
            disabled={!showNext || !isAnswered}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
              showNext && isAnswered
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          >
            次の問題
            <svg style={{width: '20px', height: '20px', marginLeft: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;