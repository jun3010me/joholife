# 問題演習システム - 問題作成ガイド

## 概要
「じょうほうらいふ」の問題演習システム用の問題データ作成・管理ガイドです。

## ディレクトリ構造
```
public/questions/
├── binary_conversion/     # 進数変換
├── algorithms/           # アルゴリズム
├── data_structures/      # データ構造
├── networks/            # ネットワーク
├── databases/           # データベース
└── programming/         # プログラミング
```

各単元ディレクトリ内：
```
{単元名}/
├── questions.yaml       # 問題データ
├── images/             # 関連画像
│   ├── problem_01.svg
│   ├── explanation_01.png
│   └── flowchart_01.svg
├── claude.md           # 単元別ガイド
└── README.md           # 単元説明
```

## 問題作成ルール

### 1. YAML形式の基本構造
```yaml
unit_name: "単元名"
description: "単元の説明"
difficulty_level: "基礎|応用|発展"
estimated_time: 15  # 分

questions:
  - id: "unique_id"
    type: "multiple_choice|input|true_false"
    difficulty: "basic|intermediate|advanced"
    question: "問題文"
    # 以下、問題タイプによって異なる
```

### 2. 問題タイプ別の設定

#### 選択問題（multiple_choice）
```yaml
type: "multiple_choice"
options:
  - "選択肢1"
  - "選択肢2"
  - "選択肢3"
  - "選択肢4"
correct: 1  # 0-indexed
```

#### 入力問題（input）
```yaml
type: "input"
answer: "正解"
# 数値の場合は文字列として記述
```

#### 正誤問題（true_false）
```yaml
type: "true_false"
correct: true  # または false
```

### 3. 共通要素
```yaml
explanation: |
  解説文
  複数行で詳しく説明
  段階的な解法を記述
formula: "$$LaTeX記法の数式$$"  # 必要に応じて
image: "./images/problem_01.svg"  # 必要に応じて
points: 10  # 配点
category: "基礎|応用|発展"
```

## 画像の扱い

### 1. 形式
- **SVG推奨**: スケーラブルでダークモード対応
- **PNG**: 写真や複雑な図
- **JPG**: 写真（ファイルサイズ重視）

### 2. 命名規則
- `problem_01.svg` - 問題図
- `explanation_01.svg` - 解説図
- `flowchart_01.svg` - フローチャート
- `circuit_01.svg` - 回路図

### 3. パス指定
```yaml
image: "./images/problem_01.svg"
explanation_image: "./images/explanation_01.svg"
```

## 数式の記述
KaTeXのLaTeX記法を使用：
```yaml
formula: "$$\\sum_{i=1}^{n} 2^i = 2^{n+1} - 2$$"
```

## 問題作成プロンプト例

### 新規単元作成
```
「情報Ⅰの{単元名}」について、以下の仕様で問題セットを作成してください：

## 作成内容
1. questions.yaml（基礎5問、応用3問、発展2問）
2. 必要に応じて画像をSVGで作成
3. 単元別のclaude.mdとREADME.md

## 学習内容
- {具体的な学習項目1}
- {具体的な学習項目2}
- {具体的な学習項目3}

## 注意事項
- 高校生レベルに適した内容
- 段階的な解説付き
- 実際の入試問題を参考

テンプレートに従って作成してください。
```

### 問題追加
```
existing questions/{単元名}/questions.yaml に{問題タイプ}の問題を{問題数}問追加してください。

## 追加する問題
- 難易度: {基礎|応用|発展}
- 学習内容: {具体的な内容}
- 特記事項: {特別な要件}

既存の形式に合わせて追加してください。
```

## 品質チェックリスト
- [ ] 問題文が明確で理解しやすい
- [ ] 選択肢が適切（明らかに間違いではない）
- [ ] 解説が段階的で分かりやすい
- [ ] 画像が適切に配置されている
- [ ] 難易度設定が適切
- [ ] YAML文法が正しい
- [ ] 高校生レベルに適している

## メタデータ管理
```yaml
metadata:
  total_questions: 10
  total_points: 150
  tags: ["タグ1", "タグ2"]
  prerequisites: ["前提単元"]
  next_units: ["次の単元"]
  created_at: "2024-XX-XX"
  updated_at: "2024-XX-XX"
  author: "じょうほうらいふ"
```

---
このガイドに従って、高品質な問題データを作成・管理してください。