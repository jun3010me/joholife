
interface ProgressBarProps {
  currentQuestion: number;
  totalQuestions: number;
  correctAnswers: number;
  timeElapsed?: number;
  className?: string;
}

const ProgressBar = ({
  currentQuestion,
  totalQuestions,
  correctAnswers,
  timeElapsed = 0,
  className = ''
}) => {
  const progress = (currentQuestion / totalQuestions) * 100;
  const accuracy = currentQuestion > 0 ? (correctAnswers / currentQuestion) * 100 : 0;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            進捗
          </span>
          <span className="text-sm text-gray-500">
            {currentQuestion} / {totalQuestions}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">
            {currentQuestion}
          </div>
          <div className="text-xs text-blue-600 font-medium">
            解答済み
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">
            {correctAnswers}
          </div>
          <div className="text-xs text-green-600 font-medium">
            正解
          </div>
        </div>
        
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-600">
            {Math.round(accuracy)}%
          </div>
          <div className="text-xs text-yellow-600 font-medium">
            正解率
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">
            {formatTime(timeElapsed)}
          </div>
          <div className="text-xs text-purple-600 font-medium">
            経過時間
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;