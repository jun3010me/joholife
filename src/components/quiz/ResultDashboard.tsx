import type { QuizResult, Question } from '../../types/question';

interface ResultDashboardProps {
  result: QuizResult;
  onRetry: () => void;
  onBackToMenu: () => void;
  onReviewIncorrect: () => void;
}

const ResultDashboard = ({
  result,
  onRetry,
  onBackToMenu,
  onReviewIncorrect
}) => {
  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreGrade = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const getScoreMessage = (percentage: number) => {
    if (percentage >= 90) return '素晴らしい！完璧に理解できています。';
    if (percentage >= 70) return 'よくできました！もう少し復習すれば完璧です。';
    if (percentage >= 50) return '合格ライン！間違えた問題を復習しましょう。';
    return '復習が必要です。基礎からもう一度確認しましょう。';
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const getPerformanceStats = () => {
    const averageTimePerQuestion = result.timeSpent / result.totalQuestions;
    const efficiency = result.correctAnswers / (result.timeSpent / 60); // 正解数/分
    
    return {
      averageTime: Math.round(averageTimePerQuestion),
      efficiency: Math.round(efficiency * 10) / 10
    };
  };

  const stats = getPerformanceStats();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          問題演習完了！
        </h2>
        <p className="text-gray-600">
          お疲れ様でした。結果を確認してください。
        </p>
      </div>

      {/* Score Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
          <div className="text-center">
            <div className={`text-6xl font-bold mb-2 ${getScoreColor(result.percentage)} bg-white bg-opacity-20 rounded-full w-24 h-24 flex items-center justify-center mx-auto`}>
              <span className="text-white">
                {getScoreGrade(result.percentage)}
              </span>
            </div>
            <div className="text-2xl font-bold mb-1">
              {result.percentage}%
            </div>
            <div className="text-blue-100">
              {result.correctAnswers} / {result.totalQuestions} 問正解
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-lg text-gray-700">
              {getScoreMessage(result.percentage)}
            </p>
          </div>
          
          {/* Detailed Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {result.totalQuestions}
              </div>
              <div className="text-sm text-blue-600 font-medium">
                総問題数
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {result.correctAnswers}
              </div>
              <div className="text-sm text-green-600 font-medium">
                正解数
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {result.totalQuestions - result.correctAnswers}
              </div>
              <div className="text-sm text-red-600 font-medium">
                不正解数
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatTime(result.timeSpent)}
              </div>
              <div className="text-sm text-purple-600 font-medium">
                所要時間
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">パフォーマンス分析</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-700">
                  {stats.averageTime}秒
                </div>
                <div className="text-sm text-gray-600">
                  平均回答時間
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-700">
                  {stats.efficiency}
                </div>
                <div className="text-sm text-gray-600">
                  効率性（正解数/分）
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onRetry}
              className="flex items-center justify-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <svg style={{width: '20px', height: '20px', marginRight: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              もう一度挑戦
            </button>
            
            {result.incorrectQuestions.length > 0 && (
              <button
                onClick={onReviewIncorrect}
                className="flex items-center justify-center px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <svg style={{width: '20px', height: '20px', marginRight: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                間違えた問題を復習
              </button>
            )}
            
            <button
              onClick={onBackToMenu}
              className="flex items-center justify-center px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <svg style={{width: '20px', height: '20px', marginRight: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              メニューに戻る
            </button>
          </div>
        </div>
      </div>

      {/* Incorrect Questions Summary */}
      {result.incorrectQuestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            間違えた問題（{result.incorrectQuestions.length}問）
          </h3>
          <div className="space-y-3">
            {result.incorrectQuestions.map((question, index) => (
              <div key={question.id} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">
                    {question.title}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {question.description}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {question.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultDashboard;