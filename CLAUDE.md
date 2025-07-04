# Claude開発メモ

このファイルは、Claudeが効率的に開発を進めるための重要な情報を記録しています。

## プロジェクト構造

### 問題演習システム

- **問題データの場所**: `public/questions/[unit_name]/questions.yaml`
- **問題一覧の管理**: `public/questions/index.yaml`
- **動的ルーティング**: `src/pages/quiz/[unit].astro`

### 新しい単元の問題を追加する手順

1. **問題ディレクトリの作成**
   ```bash
   mkdir public/questions/[unit_name]
   ```

2. **問題ファイルの作成**
   - `public/questions/[unit_name]/questions.yaml`を作成
   - 既存の問題ファイル（例：`public/questions/algorithms/questions.yaml`）と同じ構造を使用

3. **問題一覧への追加**
   - `public/questions/index.yaml`の`questionSets`配列に新しいunit_nameを追加

4. **動的ルーティングは自動更新**
   - `src/pages/quiz/[unit].astro`は`public/questions/index.yaml`から自動的に単元リストを読み取る
   - 手動でgetStaticPaths()を編集する必要はなし（2024年改善済み）

### 問題ファイルの構造

問題文、選択肢、説明などでMarkdown記法が使用可能です：
- **太字**: `**テキスト**` → **テキスト**
- *斜体*: `*テキスト*` → *テキスト*
- `コード`: `` `コード` `` → `コード`
- 改行: `<br>` または `\n`
- リンク: `[テキスト](URL)` → [テキスト](URL)

```yaml
id: unit_name
title: 単元名
description: 単元の説明
icon: 📝
difficulty: easy|medium|hard
estimatedTime: 数値（分）
category: カテゴリ名
tags:
  - タグ1
  - タグ2
questions:
  - id: q1
    type: single-choice|multiple-choice|true-false
    title: 問題のタイトル
    description: 問題文
    options:
      - id: a
        text: 選択肢のテキスト
        isCorrect: true|false
        explanation: 解説
    explanation: 問題全体の解説
    difficulty: easy|medium|hard
    tags:
      - 問題固有のタグ
    points: ポイント数
    hint: ヒント（オプション）
```

## 問題演習システムの動作

### クイズの流れ
1. 問題を表示
2. ユーザーが選択肢を選択
3. 「次の問題」ボタンをクリック
4. **解説画面を表示**（正誤判定、選択肢ごとの解説、問題全体の解説）
5. 「次の問題へ」ボタンで次の問題、または「結果を見る」で終了

### 解説画面の内容
- 正解/不正解の判定と視覚的フィードバック
- 選択肢ごとの正誤表示（正解は緑、ユーザーの誤答は赤）
- 各選択肢の解説（option.explanation）
- 問題全体の詳しい解説（question.explanation）

## 開発時の注意点

- 新しい単元を追加する際は、上記の3つのステップを実行すること（動的ルーティングは自動更新）
- 問題ファイルの構造は既存のものと完全に一致させること（`correct_answer`形式ではなく`isCorrect`形式を使用）
- `public/questions/index.yaml`への追加を忘れると新しい単元にアクセスできない
- 選択肢と問題の両方に`explanation`フィールドを設定することで、より詳細な学習体験を提供

## コマンド

- 開発サーバー起動: `npm run dev`
- ビルド: `npm run build`
- プレビュー: `npm run preview`