import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { Play, Square, RotateCcw, Download, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CodeExecutorProps {
  language: 'javascript' | 'python' | 'sql';
  initialCode?: string;
  height?: string;
  readOnly?: boolean;
  showOutput?: boolean;
  title?: string;
}

export const CodeExecutor: React.FC<CodeExecutorProps> = ({
  language,
  initialCode = '',
  height = '300px',
  readOnly = false,
  showOutput = true,
  title,
}) => {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const executeJavaScript = async (code: string) => {
    try {
      // シンプルなJavaScript実行（実際のプロジェクトではサンドボックスが必要）
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      };

      // eslint-disable-next-line no-eval
      const result = eval(code);
      
      console.log = originalLog;
      
      let output = logs.length > 0 ? logs.join('\n') : '';
      if (result !== undefined) {
        output += (output ? '\n' : '') + `戻り値: ${result}`;
      }
      
      return output || '実行完了（出力なし）';
    } catch (error) {
      throw new Error(`実行エラー: ${error}`);
    }
  };

  const executePython = async (code: string) => {
    // 実際のPython実行には Pyodide が必要
    return 'Python実行は開発中です...';
  };

  const executeSQL = async (code: string) => {
    // SQL実行の実装（sql.js-httpvfsを使用）
    return 'SQL実行は開発中です...';
  };

  const runCode = async () => {
    if (!code.trim()) {
      setOutput('コードを入力してください');
      return;
    }

    setIsRunning(true);
    setError('');
    setOutput('実行中...');

    try {
      let result = '';
      
      switch (language) {
        case 'javascript':
          result = await executeJavaScript(code);
          break;
        case 'python':
          result = await executePython(code);
          break;
        case 'sql':
          result = await executeSQL(code);
          break;
        default:
          throw new Error(`サポートされていない言語: ${language}`);
      }
      
      setOutput(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'エラーが発生しました');
      setOutput('');
    } finally {
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    setCode(initialCode);
    setOutput('');
    setError('');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      // 簡単なフィードバック表示
    } catch (error) {
      console.error('コピーに失敗しました:', error);
    }
  };

  const downloadCode = () => {
    const extension = language === 'javascript' ? 'js' : language === 'python' ? 'py' : 'sql';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLanguageLabel = () => {
    switch (language) {
      case 'javascript': return 'JavaScript';
      case 'python': return 'Python';
      case 'sql': return 'SQL';
      default: return language;
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">
            {title || `${getLanguageLabel()} コードエディタ`}
          </span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {getLanguageLabel()}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={copyCode}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="コードをコピー"
          >
            <Copy size={16} />
          </button>
          
          <button
            onClick={downloadCode}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="コードをダウンロード"
          >
            <Download size={16} />
          </button>
          
          <button
            onClick={resetCode}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="リセット"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <Editor
          height={height}
          language={language === 'sql' ? 'sql' : language}
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
          theme="vs-light"
        />
      </div>

      {/* Controls */}
      {!readOnly && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-300">
          <div className="flex items-center space-x-2">
            <button
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <Square size={14} />
              ) : (
                <Play size={14} />
              )}
              <span>{isRunning ? '実行中...' : '実行'}</span>
            </button>
            
            <span className="text-xs text-gray-500">
              Ctrl+Enter でも実行できます
            </span>
          </div>
        </div>
      )}

      {/* Output */}
      {showOutput && (
        <AnimatePresence>
          {(output || error) && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="border-t border-gray-300 overflow-hidden"
            >
              <div className="bg-gray-900 text-white p-4">
                <div className="text-xs text-gray-400 mb-2">出力:</div>
                {error ? (
                  <pre className="text-red-400 text-sm whitespace-pre-wrap">{error}</pre>
                ) : (
                  <pre className="text-green-400 text-sm whitespace-pre-wrap">{output}</pre>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

// 使用例のコンポーネント
export const CodeExample: React.FC<{
  title: string;
  description?: string;
  code: string;
  language: 'javascript' | 'python' | 'sql';
}> = ({ title, description, code, language }) => {
  return (
    <div className="my-6">
      <h3 className="text-lg font-medium text-gray-800 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 mb-4">{description}</p>
      )}
      <CodeExecutor
        language={language}
        initialCode={code}
        height="200px"
        title={title}
      />
    </div>
  );
};