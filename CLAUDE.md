# Claude開発メモ

このファイルは、Claudeが効率的に開発を進めるための重要な情報を記録しています。

## プロジェクト構造

### レッスンシステム（スライド形式学習）

- **レッスン一覧ページ**: `src/pages/lessons/index.astro`
- **個別レッスンページ**: `src/pages/lessons/[chapter]/[slide].astro` (動的ルーティング)
- **特定レッスンページ**: `src/pages/lessons/programming-basics/1.astro` (個別実装)
- **レッスンデータ**: `src/content/lessons/` (MDXファイル、現在は未使用)

#### レッスンページの作成手順

1. **基本構造のコピー**
   ```bash
   # 既存のレッスンページをテンプレートとして使用
   cp src/pages/lessons/programming-basics/1.astro src/pages/lessons/[new-chapter]/1.astro
   ```

2. **メタデータの更新**
   ```javascript
   const title = "新しいレッスンのタイトル";
   const description = "レッスンの説明";
   const chapter = "new-chapter"; // URL用のID
   const slideNumber = 1;
   const totalSlides = 5; // スライド数に応じて調整
   const estimatedTime = 10; // 推定学習時間（分）
   ```

3. **スライドデータの作成**
   ```javascript
   const slides = [
     {
       id: 1,
       title: "スライドタイトル",
       content: `
         <div>
           <h1>メインタイトル</h1>
           <p>説明文</p>
           <!-- HTMLコンテンツをここに記述 -->
         </div>
       `
     },
     // 追加のスライド...
   ];
   ```

4. **レッスン一覧への追加**
   - `src/pages/lessons/index.astro`の`chapters`配列に新しいチャプターを追加
   ```javascript
   {
     id: 'new-chapter',
     title: '新しいチャプター',
     description: 'チャプターの説明',
     icon: '🎯',
     difficulty: 'easy|medium|hard',
     color: 'blue|green|purple|yellow|red'
   }
   ```

### レッスンシステムの技術仕様

#### 1. **バニラJavaScript実装**
- **React不使用**: フック問題回避のため、純粋なHTML+CSS+JavaScriptで実装
- **スライド切り替え**: `display: none/block` による表示制御
- **状態管理**: グローバル変数による現在のスライド管理

#### 2. **スライド構造**
```html
<div class="slide-content active" id="slide-0">
  <div class="slide-inner">
    <div set:html={slide.content} />
  </div>
</div>
```

#### 3. **ナビゲーション機能**
- **キーボードショートカット**: 矢印キー、スペース、Home/End
- **マウス操作**: ナビゲーションボタン、サムネイルクリック
- **プログレスバー**: 進捗の視覚的表示
- **スライドカウンター**: 現在位置の表示

#### 4. **スタイリング**
- **フルスクリーン表示**: 100vh layout
- **レスポンシブ対応**: モバイル・タブレット・デスクトップ
- **スムーズなトランジション**: opacity fadeによるスライド切り替え
- **カスタムCSS**: インラインスタイルによる自己完結型デザイン

#### 5. **コンテンツ形式**
- **HTMLコンテンツ**: スライド内容はHTMLとインラインCSSで記述
- **Markdown不使用**: 直接HTMLを記述して表現力を最大化
- **インラインスタイル**: 各要素に直接CSSを適用

### レッスンページのテンプレート構造

```javascript
---
const title = "レッスンタイトル";
const description = "レッスンの説明";
const chapter = "chapter-id";
const slideNumber = 1;
const totalSlides = 5;
const estimatedTime = 10;

const slides = [
  {
    id: 1,
    title: "スライド1",
    content: `<div><h1>タイトル</h1><p>内容</p></div>`
  },
  // ... 他のスライド
];
---

<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- メタデータ -->
</head>
<body>
  <!-- ヘッダー（ナビゲーション、プログレスバー） -->
  <!-- スライドコンテンツエリア -->
  <!-- フッター（サムネイル、キーボードヒント） -->
  <!-- バニラJavaScriptによる制御 -->
</body>
</html>
```

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
1. **氏名入力画面**で名前を入力（修了証発行のため）
2. 問題を表示
3. ユーザーが選択肢を選択
4. 「次の問題」ボタンをクリック
5. **解説画面を表示**（正誤判定、選択肢ごとの解説、問題全体の解説）
6. 「次の問題へ」ボタンで次の問題、または「結果を見る」で終了
7. **100%達成時**: 修了証画面を表示し、ダウンロード可能

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

## 現在利用可能なレッスンセット

1. **programming-basics** (プログラミング基礎): プログラミングの基本概念 - 初級レベル - 5スライド
   - スライド1: 学習目標
   - スライド2: プログラミングの定義
   - スライド3: プログラミングの重要性
   - スライド4: プログラムの基本要素（順次・分岐・反復）
   - スライド5: プログラミングの思考プロセス

## 現在利用可能な問題セット

1. **binary_conversion** (2進数変換): 2進数と10進数の変換 - 初級レベル
2. **algorithms** (アルゴリズムの基礎): アルゴリズムと計算量 - 中級レベル  
3. **copyright** (著作権): 著作権法の基本概念と事例 - 中級レベル
4. **industrial** (産業財産権): 特許権、実用新案権、意匠権、商標権 - 中級レベル

## レッスン開発のベストプラクティス

### スライド作成時の注意点

1. **適切なスライド数**: 5-8スライドが理想的（集中力維持のため）
2. **視覚的要素**: アイコン、色分け、カードレイアウトを活用
3. **段階的学習**: 概念 → 例 → 実践 → まとめの流れ
4. **インタラクティブ要素**: 図解、例示、比較表など

### HTMLコンテンツの記述規則

1. **インラインCSS使用**: スタイルは各要素に直接記述
2. **カラーパレット**: 統一された色使い（青系、緑系、黄系、赤系、紫系）
3. **グリッドレイアウト**: `display: grid` でカード配置
4. **アイコン使用**: 絵文字を効果的に活用
5. **レスポンシブ対応**: `min-width`, `flex-wrap` などの活用

## 計算や手順表示のレイアウト技法

### 筆算形式の表示

数学的な計算（割り算、筆算など）を表示する場合の推奨パターン：

```html
<!-- 筆算形式（2進数変換の割り算など） -->
<div style="font-family: 'Courier New', monospace; font-size: 1.1rem; line-height: 1.8; background: #f8fafc; padding: 2rem; border-radius: 0.5rem; margin: 1rem 0; display: flex; flex-direction: column; align-items: center;">
  <div style="margin-bottom: 1rem;">
    <span style="color: #3b82f6; font-weight: bold;">2)</span><span style="text-decoration: overline;">13</span> = 6 ・・・ <span style="background: #fef3c7; padding: 0.2rem 0.5rem; border-radius: 0.25rem; color: #92400e; font-weight: bold;">1</span> ←④
  </div>
  <!-- 追加の計算行... -->
</div>
```

**ポイント:**
- `Courier New`, monospace フォントで文字幅を統一
- `display: flex; flex-direction: column; align-items: center;` で中央配置
- `text-decoration: overline` で筆算の上線を表現
- 余りや重要な部分は背景色でハイライト

### 計算手順のテーブル表示

複数の要素を整列させる計算手順は、テーブル形式を推奨：

```html
<table style="width: 100%; max-width: 300px; margin: 0 auto; font-family: 'Courier New', monospace; border-collapse: collapse;">
  <tr style="line-height: 1.8;">
    <td style="text-align: right; width: 8%; padding-right: 0.2rem;">13</td>
    <td style="text-align: center; width: 4%; padding: 0 0.1rem;">≥</td>
    <td style="text-align: right; width: 6%; padding-right: 0.1rem;">8</td>
    <td style="text-align: left; width: 10%; padding-left: 0.2rem;">(2³)</td>
    <td style="text-align: center; width: 4%; padding: 0 0.2rem;">→</td>
    <td style="text-align: center; width: 4%;"><span style="color: #22c55e;">○</span></td>
    <!-- 追加のセル... -->
  </tr>
</table>
```

**ポイント:**
- `max-width: 300px` でPC表示時の横幅を制限
- `margin: 0 auto` で中央配置
- 各セルの幅を細かく調整（数字は8%、演算子は3-4%など）
- `text-align` で各要素の配置を最適化
- `padding` を0.1-0.2remに抑えて要素間を詰める

### 2つの手法比較表示

同じ概念の異なる手法を並べて表示する場合：

```html
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
  <div style="background: #f0f9ff; padding: 2rem; border-radius: 1rem; border: 1px solid #3b82f6;">
    <h2 style="color: #3b82f6;">方法1: 割り算法</h2>
    <!-- 割り算法の内容 -->
  </div>
  <div style="background: #f0fdf4; padding: 2rem; border-radius: 1rem; border: 1px solid #22c55e;">
    <h2 style="color: #22c55e;">方法2: 引き算法</h2>
    <!-- 引き算法の内容 -->
  </div>
</div>
```

### レスポンシブ対応の重要点

- **PC向け**: `max-width` で表示幅を制限
- **スマホ向け**: `width: 100%` で画面幅に合わせる
- **フォント**: モノスペースフォント（Courier New）で整列を保証
- **中央配置**: `margin: 0 auto` または `align-items: center` を活用

### 色使いのガイドライン

計算表示での色分け：
- **青系** (#3b82f6): 除数、基本操作
- **緑系** (#22c55e): 正解、成功状態
- **黄系** (#f59e0b): ハイライト、余り
- **赤系** (#ef4444): エラー、不正解
- **背景色**: 薄いトーン (#f0f9ff, #f0fdf4など)でセクション分け

### 推奨コンテンツ構造

```html
<!-- 標準的なスライド構造 -->
<div>
  <h1>メインタイトル</h1>
  <h2>🎯 セクションタイトル</h2>
  <p>説明文</p>
  
  <!-- カード形式のコンテンツ -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 2rem 0;">
    <div style="background: #f0fdf4; padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #22c55e;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎯</div>
      <h3>項目タイトル</h3>
      <p>項目の説明</p>
    </div>
  </div>
  
  <!-- 重要なポイント -->
  <div style="background: #fef3c7; padding: 1.5rem; border-radius: 0.75rem; margin-top: 2rem; border: 1px solid #f59e0b;">
    <h3>💡 重要なポイント</h3>
    <p>強調したい内容</p>
  </div>
</div>
```

### 新規レッスン作成時のチェックリスト

- [ ] メタデータ（title, description, chapter, estimatedTime）の設定
- [ ] スライド数の適切性（5-8枚）
- [ ] 各スライドのタイトル設定
- [ ] HTMLコンテンツの動作確認
- [ ] レスポンシブ表示の確認
- [ ] キーボードナビゲーションのテスト
- [ ] レッスン一覧ページへの追加
- [ ] ビルドエラーのチェック

## レッスン作成依頼のテンプレート

新しいレッスンを作成依頼する際は、以下の情報を提供してください：

```
レッスン作成依頼：

【基本情報】
- レッスンタイトル: 
- チャプターID: 
- 難易度: easy/medium/hard
- 推定学習時間: 分
- アイコン: 絵文字1つ
- カラーテーマ: blue/green/purple/yellow/red

【学習目標】
- このレッスンで学ぶべきこと:
  - 
  - 
  - 

【内容の要望】
- 含めたい概念やトピック:
- 重視したいポイント:
- 避けたい内容:

【想定するスライド構成】
1. 学習目標
2. 
3. 
4. 
5. まとめ

【参考資料】
- 参考にしたいサイトやドキュメント:
```

### 効率的な依頼方法の例

```
「データベース基礎」のレッスンを作成してください。

【基本情報】
- レッスンタイトル: データベースの基礎
- チャプターID: database-basics
- 難易度: medium
- 推定学習時間: 12分
- アイコン: 🗄️
- カラーテーマ: purple

【学習目標】
- データベースとは何かを理解する
- リレーショナルデータベースの概念を学ぶ
- テーブル、行、列の関係を把握する
- SQLの基本的な概念を知る

【内容の要望】
- 身近な例（図書館、住所録など）を使った説明
- 視覚的な図解を多用
- 専門用語は分かりやすく解説

【想定するスライド構成】
1. 学習目標
2. データベースとは何か
3. 身近なデータベースの例
4. リレーショナルデータベースの仕組み
5. SQLの基本概念
6. まとめと次のステップ
```

## コマンド

- 開発サーバー起動: `npm run dev`
- ビルド: `npm run build`
- プレビュー: `npm run preview`