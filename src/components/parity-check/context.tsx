import { createContext, useContext } from 'react';
import type { Problem } from '../../utils/parity-check/log.ts';

/** 操作ログ（全ステージで共有。localStorageへの保存は ParityApp が行う） */
export interface LogApi {
  problems: Problem[];
  /** 問題を追加し、その番号を返す */
  add: (p: Problem) => number;
  /** 番号の問題を書き換える */
  patch: (i: number, f: (p: Problem) => Problem) => void;
}
export const LogContext = createContext<LogApi | null>(null);
export const useLog = (): LogApi => {
  const c = useContext(LogContext);
  if (!c) throw new Error('LogContext がありません');
  return c;
};
