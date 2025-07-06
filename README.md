# joholife

魚住惇が運営している高校教科「情報Ⅰ・Ⅱ」の学習支援サイトです。

## 機能

- **問題演習システム**: 各単元の理解度を確認できる問題演習
- **学習ツール**: 2進数変換、16進数変換、画像デジタル化シミュレーターなど
- **論理回路シミュレーター**: 論理回路の動作を視覚的に確認
- **修了証発行**: 100%正答率で修了証を発行

## ローカル環境での実行

### 必要な環境

- Node.js 18以上
- npm

### セットアップ

1. リポジトリをクローン
```bash
git clone https://github.com/jun3010me/joholife.git
cd joholife
```

2. 依存関係をインストール
```bash
npm install
```

3. 開発サーバーを起動
```bash
npm run dev
```

4. ブラウザで http://localhost:4321 を開く

### その他のコマンド

```bash
# 本番用ビルド
npm run build

# ビルド結果をプレビュー
npm run preview
```

## 問題演習システム

### 新しい問題セットの追加

1. `public/questions/[unit_name]/` ディレクトリを作成
2. `questions.yaml` ファイルを作成（既存の問題ファイルを参考）
3. `public/questions/index.yaml` の `questionSets` に単元名を追加

### 問題ファイルの構造

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

## 技術スタック

- **フレームワーク**: Astro
- **スタイリング**: Tailwind CSS
- **UI コンポーネント**: React
- **データ形式**: YAML
- **数式表示**: KaTeX

## ライセンス

このプロジェクトは **CC BY-NC-SA 4.0（クリエイティブ・コモンズ 表示-非営利-継承 4.0 国際）** ライセンスの下で提供されています。

### ライセンス概要

- **表示（BY）**: 作品を利用する際は、作者名「魚住惇」とライセンスを明記してください
- **非営利（NC）**: 営利目的での利用は禁止されています
- **継承（SA）**: この作品を改変・再配布する場合は、同じライセンスを適用してください

### 利用について

このライセンスにより、以下のような利用が可能です：

- 教育機関での授業での使用
- 学習目的での個人利用
- 非営利団体での研修・ワークショップでの使用
- 作品の改変・再配布（同じライセンスを適用する場合）

### 連絡先

ライセンスに関するご質問やご相談については、以下までお気軽にお問い合わせください：

**魚住惇**  
uozumi5010あっとaichi-c.ed.jp

---

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="クリエイティブ・コモンズ・ライセンス" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />この作品は <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">クリエイティブ・コモンズ 表示 - 非営利 - 継承 4.0 国際 ライセンス</a>の下に提供されています。