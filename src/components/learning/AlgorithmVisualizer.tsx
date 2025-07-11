import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, SkipBack } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';

interface AlgorithmVisualizerProps {
  algorithm: 'bubble-sort' | 'selection-sort' | 'linear-search' | 'binary-search';
  data?: number[];
  speed?: number;
  title?: string;
}

export const AlgorithmVisualizer: React.FC<AlgorithmVisualizerProps> = ({
  algorithm,
  data = [64, 34, 25, 12, 22, 11, 90],
  speed = 1000,
  title,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [arrayData, setArrayData] = useState([...data]);
  const [steps, setSteps] = useState<Array<{
    array: number[];
    comparing: number[];
    swapping: number[];
    sorted: number[];
    found?: number;
    description: string;
  }>>([]);
  const [searchTarget, setSearchTarget] = useState<number | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // アルゴリズムの実行ステップを生成
  useEffect(() => {
    generateSteps();
  }, [algorithm, data, searchTarget]);

  const generateSteps = () => {
    const newSteps: typeof steps = [];
    const arr = [...data];
    
    switch (algorithm) {
      case 'bubble-sort':
        generateBubbleSortSteps(arr, newSteps);
        break;
      case 'selection-sort':
        generateSelectionSortSteps(arr, newSteps);
        break;
      case 'linear-search':
        if (searchTarget !== null) {
          generateLinearSearchSteps(arr, searchTarget, newSteps);
        }
        break;
      case 'binary-search':
        if (searchTarget !== null) {
          const sortedArr = [...arr].sort((a, b) => a - b);
          generateBinarySearchSteps(sortedArr, searchTarget, newSteps);
        }
        break;
    }
    
    setSteps(newSteps);
    setCurrentStep(0);
  };

  const generateBubbleSortSteps = (arr: number[], steps: typeof steps) => {
    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: [],
      description: 'バブルソート開始：隣接する要素を比較して交換を繰り返します'
    });

    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        // 比較
        steps.push({
          array: [...arr],
          comparing: [j, j + 1],
          swapping: [],
          sorted: Array.from({ length: i }, (_, idx) => n - 1 - idx),
          description: `${arr[j]} と ${arr[j + 1]} を比較`
        });

        if (arr[j] > arr[j + 1]) {
          // 交換
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          steps.push({
            array: [...arr],
            comparing: [],
            swapping: [j, j + 1],
            sorted: Array.from({ length: i }, (_, idx) => n - 1 - idx),
            description: `${arr[j + 1]} と ${arr[j]} を交換`
          });
        }
      }
    }

    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: Array.from({ length: n }, (_, idx) => idx),
      description: 'ソート完了！'
    });
  };

  const generateSelectionSortSteps = (arr: number[], steps: typeof steps) => {
    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: [],
      description: '選択ソート開始：最小値を見つけて先頭に移動を繰り返します'
    });

    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      
      steps.push({
        array: [...arr],
        comparing: [i],
        swapping: [],
        sorted: Array.from({ length: i }, (_, idx) => idx),
        description: `位置 ${i} の最小値を探索開始`
      });

      for (let j = i + 1; j < n; j++) {
        steps.push({
          array: [...arr],
          comparing: [minIdx, j],
          swapping: [],
          sorted: Array.from({ length: i }, (_, idx) => idx),
          description: `${arr[minIdx]} と ${arr[j]} を比較`
        });

        if (arr[j] < arr[minIdx]) {
          minIdx = j;
        }
      }

      if (minIdx !== i) {
        [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
        steps.push({
          array: [...arr],
          comparing: [],
          swapping: [i, minIdx],
          sorted: Array.from({ length: i + 1 }, (_, idx) => idx),
          description: `最小値 ${arr[i]} を位置 ${i} に移動`
        });
      }
    }

    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: Array.from({ length: n }, (_, idx) => idx),
      description: 'ソート完了！'
    });
  };

  const generateLinearSearchSteps = (arr: number[], target: number, steps: typeof steps) => {
    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: [],
      description: `線形探索開始：${target} を探します`
    });

    for (let i = 0; i < arr.length; i++) {
      steps.push({
        array: [...arr],
        comparing: [i],
        swapping: [],
        sorted: [],
        description: `位置 ${i}: ${arr[i]} をチェック`
      });

      if (arr[i] === target) {
        steps.push({
          array: [...arr],
          comparing: [],
          swapping: [],
          sorted: [],
          found: i,
          description: `見つかりました！位置 ${i} に ${target} があります`
        });
        return;
      }
    }

    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: [],
      description: `${target} は見つかりませんでした`
    });
  };

  const generateBinarySearchSteps = (arr: number[], target: number, steps: typeof steps) => {
    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: [],
      description: `二分探索開始：ソートされた配列から ${target} を探します`
    });

    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      steps.push({
        array: [...arr],
        comparing: [mid],
        swapping: [],
        sorted: [],
        description: `中央位置 ${mid}: ${arr[mid]} をチェック`
      });

      if (arr[mid] === target) {
        steps.push({
          array: [...arr],
          comparing: [],
          swapping: [],
          sorted: [],
          found: mid,
          description: `見つかりました！位置 ${mid} に ${target} があります`
        });
        return;
      } else if (arr[mid] < target) {
        left = mid + 1;
        steps.push({
          array: [...arr],
          comparing: [],
          swapping: [],
          sorted: [],
          description: `${arr[mid]} < ${target} なので右半分を探索`
        });
      } else {
        right = mid - 1;
        steps.push({
          array: [...arr],
          comparing: [],
          swapping: [],
          sorted: [],
          description: `${arr[mid]} > ${target} なので左半分を探索`
        });
      }
    }

    steps.push({
      array: [...arr],
      comparing: [],
      swapping: [],
      sorted: [],
      description: `${target} は見つかりませんでした`
    });
  };

  // アニメーション制御
  const play = () => {
    if (currentStep >= steps.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const reset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setArrayData([...data]);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 自動再生
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speed, steps.length]);

  // 現在のステップデータ
  const currentStepData = steps[currentStep] || {
    array: arrayData,
    comparing: [],
    swapping: [],
    sorted: [],
    description: '準備中...'
  };

  const getBarColor = (index: number) => {
    if (currentStepData.found === index) return '#10B981'; // green-500
    if (currentStepData.sorted.includes(index)) return '#6366F1'; // indigo-500
    if (currentStepData.swapping.includes(index)) return '#EF4444'; // red-500
    if (currentStepData.comparing.includes(index)) return '#F59E0B'; // amber-500
    return '#9CA3AF'; // gray-400
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-800">
            {title || `${algorithm.replace('-', ' ').toUpperCase()} 可視化`}
          </h3>
          
          {(algorithm.includes('search')) && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">探索値:</label>
              <input
                type="number"
                value={searchTarget || ''}
                onChange={(e) => setSearchTarget(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="値"
              />
            </div>
          )}
        </div>
      </div>

      {/* 可視化エリア */}
      <div className="p-6 bg-white">
        <div className="mb-4">
          <div className="flex items-center justify-center space-x-4 mb-4">
            {currentStepData.array.map((value, index) => (
              <motion.div
                key={index}
                className="flex flex-col items-center"
                animate={{
                  scale: currentStepData.comparing.includes(index) || 
                         currentStepData.swapping.includes(index) ? 1.1 : 1
                }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="w-12 h-12 flex items-center justify-center rounded-lg text-white font-bold text-sm"
                  animate={{
                    backgroundColor: getBarColor(index),
                    y: currentStepData.swapping.includes(index) ? -10 : 0
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {value}
                </motion.div>
                <div className="text-xs text-gray-500 mt-1">{index}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 説明 */}
        <div className="text-center mb-4">
          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
            {currentStepData.description}
          </p>
        </div>

        {/* 進捗 */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>ステップ {currentStep + 1} / {steps.length}</span>
            <span>速度: {speed}ms</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* コントロール */}
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="前のステップ"
          >
            <SkipBack size={16} />
          </button>
          
          <button
            onClick={isPlaying ? pause : play}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? '一時停止' : '再生'}</span>
          </button>
          
          <button
            onClick={nextStep}
            disabled={currentStep === steps.length - 1}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="次のステップ"
          >
            <SkipForward size={16} />
          </button>
          
          <button
            onClick={reset}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            title="リセット"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* 凡例 */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span>未処理</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-amber-500 rounded"></div>
            <span>比較中</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>交換中</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-indigo-500 rounded"></div>
            <span>ソート済み</span>
          </div>
          {algorithm.includes('search') && (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>発見</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};