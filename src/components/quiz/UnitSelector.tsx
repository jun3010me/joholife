import type { QuestionSet } from '../../types/question';

interface UnitSelectorProps {
  questionSets: QuestionSet[];
  onSelectUnit: (unitId: string) => void;
  isLoading?: boolean;
}

const UnitSelector = ({ 
  questionSets, 
  onSelectUnit, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="text-gray-600">問題を読み込み中...</span>
        </div>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'from-green-500 to-emerald-600';
      case 'medium':
        return 'from-yellow-500 to-orange-600';
      case 'hard':
        return 'from-red-500 to-pink-600';
      default:
        return 'from-blue-500 to-purple-600';
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
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          問題演習を始めましょう
        </h2>
        <p className="text-gray-600">
          学習したい単元を選択してください
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {questionSets.map((questionSet) => (
          <div
            key={questionSet.id}
            className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            onClick={() => onSelectUnit(questionSet.id)}
          >
            <div className={`bg-gradient-to-r ${getDifficultyColor(questionSet.difficulty)} p-6 rounded-t-xl`}>
              <div className="flex items-center justify-between">
                <div className="text-4xl">{questionSet.icon}</div>
                <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  <span className="text-white text-sm font-medium">
                    {getDifficultyText(questionSet.difficulty)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {questionSet.title}
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                {questionSet.description}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <svg style={{width: '16px', height: '16px', marginRight: '4px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {questionSet.estimatedTime}分
                  </span>
                  <span className="flex items-center">
                    <svg style={{width: '16px', height: '16px', marginRight: '4px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {questionSet.questions.length}問
                  </span>
                </div>
              </div>
              
              {questionSet.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {questionSet.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {questionSet.tags.length > 3 && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                      +{questionSet.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {questionSets.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            問題データが見つかりません
          </h3>
          <p className="text-gray-500">
            問題データを読み込めませんでした。管理者にお問い合わせください。
          </p>
        </div>
      )}
    </div>
  );
};

export default UnitSelector;