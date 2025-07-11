import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathRendererProps {
  math: string;
  block?: boolean;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  math,
  block = false,
  className = '',
}) => {
  try {
    if (block) {
      return (
        <div className={`my-4 text-center ${className}`}>
          <BlockMath math={math} />
        </div>
      );
    }
    
    return (
      <span className={className}>
        <InlineMath math={math} />
      </span>
    );
  } catch (error) {
    console.error('KaTeX rendering error:', error);
    return (
      <span className={`bg-red-100 text-red-800 px-2 py-1 rounded ${className}`}>
        数式エラー: {math}
      </span>
    );
  }
};

// 論理式専用のコンポーネント
interface LogicFormulaProps {
  formula: string;
  truthTable?: boolean;
  className?: string;
}

export const LogicFormula: React.FC<LogicFormulaProps> = ({
  formula,
  truthTable = false,
  className = '',
}) => {
  // 論理演算子の変換
  const convertLogicSymbols = (text: string) => {
    return text
      .replace(/AND/g, '\\land')
      .replace(/OR/g, '\\lor')
      .replace(/NOT/g, '\\lnot')
      .replace(/XOR/g, '\\oplus')
      .replace(/NAND/g, '\\uparrow')
      .replace(/NOR/g, '\\downarrow')
      .replace(/->/g, '\\rightarrow')
      .replace(/<->/g, '\\leftrightarrow');
  };

  const convertedFormula = convertLogicSymbols(formula);

  if (truthTable) {
    return (
      <div className={`border border-gray-300 rounded-lg overflow-hidden ${className}`}>
        <div className="bg-gray-50 p-3 border-b">
          <MathRenderer math={convertedFormula} block={true} />
        </div>
        <div className="p-3">
          <TruthTableGenerator formula={formula} />
        </div>
      </div>
    );
  }

  return <MathRenderer math={convertedFormula} block={true} className={className} />;
};

// 真理値表生成器
interface TruthTableGeneratorProps {
  formula: string;
}

const TruthTableGenerator: React.FC<TruthTableGeneratorProps> = ({ formula }) => {
  // 簡単な真理値表の例（実際の実装では論理式パーサーが必要）
  const generateTruthTable = (formula: string) => {
    // ここでは簡単な例として A AND B の真理値表を返す
    if (formula.includes('AND')) {
      return [
        { A: false, B: false, result: false },
        { A: false, B: true, result: false },
        { A: true, B: false, result: false },
        { A: true, B: true, result: true },
      ];
    }
    
    if (formula.includes('OR')) {
      return [
        { A: false, B: false, result: false },
        { A: false, B: true, result: true },
        { A: true, B: false, result: true },
        { A: true, B: true, result: true },
      ];
    }
    
    return [];
  };

  const table = generateTruthTable(formula);
  
  if (table.length === 0) {
    return <div className="text-gray-500">真理値表を生成できませんでした</div>;
  }

  const variables = Object.keys(table[0]).filter(key => key !== 'result');

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {variables.map(variable => (
              <th key={variable} className="border border-gray-300 px-3 py-2 text-center font-medium">
                {variable}
              </th>
            ))}
            <th className="border border-gray-300 px-3 py-2 text-center font-medium">
              結果
            </th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {variables.map(variable => (
                <td key={variable} className="border border-gray-300 px-3 py-2 text-center">
                  {row[variable as keyof typeof row] ? '1' : '0'}
                </td>
              ))}
              <td className={`border border-gray-300 px-3 py-2 text-center font-medium ${
                row.result ? 'text-green-600' : 'text-red-600'
              }`}>
                {row.result ? '1' : '0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};