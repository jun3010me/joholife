import React from 'react';
import { CodeExecutor, CodeExample } from './CodeExecutor';

// クライアントサイドでのみ使用するラッパーコンポーネント
export const ClientCodeExecutor = (props: any) => {
  return <CodeExecutor {...props} />;
};

export const ClientCodeExample = (props: any) => {
  return <CodeExample {...props} />;
};