# ネットワーク構築課題開発ガイド

## 今回のトラブル分析と対策

### 問題の経緯

**2025年9月16日に発生した問題:**
- ネットワーク構築課題②で、正しいJSONファイルが不正解と判定される
- ユーザーは課題通りにPC-3のIPアドレスを修正したが、何度も不正解になった

### 根本原因

#### 1. ネットワークシミュレータのJSONデータ構造の問題
**問題**: デバイス配置時に設定される`lan1.ipAddress`が、ユーザーのIP変更時に同期されていなかった
```json
{
  "config": {
    "ipAddress": "192.168.1.102",  // ← ユーザーが修正した値
    "lan1": {
      "ipAddress": "10.0.1.100"    // ← 古い初期値のまま残る
    }
  }
}
```

**修正内容**:
- `saveDeviceConfig()`でIPアドレス更新時に`lan1.ipAddress`も同期
- DHCP自動取得時も同様に同期処理を追加
- ファイル読み込み時に`syncLAN1Addresses()`で既存データを修正

#### 2. 問題演習システムの重複IP判定ロジックの欠陥
**問題**: PC/サーバー/スイッチで`config.ipAddress`と`lan1.ipAddress`が二重カウントされる
```javascript
// 修正前: PC-1で192.168.1.100が2回カウントされる
usedIPs.add(device.config.ipAddress);        // 192.168.1.100
usedIPs.add(device.config.lan1.ipAddress);   // 192.168.1.100 (重複)
```

**修正内容**: ルーター以外は`lan1.ipAddress`をスキップ

#### 3. YAML解析処理の配列対応不備
**問題**: 配列形式のYAMLで2行目以降のプロパティが読み込まれない
```yaml
expectedChanges:
  - deviceName: "PC-3"      # ← 読み込まれる
    property: "config.ipAddress"  # ← 読み込まれない
    expectedPattern: "^192\\.168\\.1\\.[0-9]+$"  # ← 読み込まれない
```

**修正内容**: インデント6と8の両方で処理、配列項目の全プロパティを解析

---

## 今後の課題作成チェックリスト

### 1. ネットワーク構築課題設計時

#### ✅ 課題設定の確認
- [ ] 課題の学習目標が明確に定義されている
- [ ] 初期状態と修正後の期待値が具体的に記述されている
- [ ] IPアドレスの重複パターンが適切に設計されている
- [ ] デバイス名が一意で分かりやすい（PC-1, PC-2, PC-3など）

#### ✅ YAMLファイルの記述
```yaml
# 推奨: オブジェクト形式（解析エラーが少ない）
expectedChanges:
  deviceName: "PC-3"
  property: "config.ipAddress"
  expectedPattern: "^192\\.168\\.1\\.[0-9]+$"
  explanation: "詳細な解説"
  excludeValues: ["192.168.1.100", "192.168.1.101"]

# 非推奨: 配列形式（解析処理が複雑）
expectedChanges:
  - deviceName: "PC-3"
    property: "config.ipAddress"
```

#### ✅ 問題ファイル作成
- [ ] 課題ファイル（problem.json）に意図的な問題を仕込む
- [ ] 修正対象のデバイスのIPアドレスが明らかに間違っている
- [ ] 他のデバイスとの重複や異なるサブネットなど、分かりやすい問題設定

### 2. 開発・テスト段階

#### ✅ ネットワークシミュレータのテスト
- [ ] デバイス配置→IP変更→JSON保存→再読み込みのフローをテスト
- [ ] 保存されたJSONで`config.ipAddress`と`lan1.ipAddress`が一致することを確認
- [ ] DHCP有効→無効、無効→有効の切り替えテスト
- [ ] 複数デバイスでIPアドレス変更後の保存・読み込みテスト

#### ✅ 問題演習システムのテスト
- [ ] 課題ファイルをダウンロードして実際に問題を確認
- [ ] シミュレータで修正→保存→アップロードのフローをテスト
- [ ] 正解ケースと不正解ケース（重複IP、無効IPなど）の両方をテスト
- [ ] ブラウザコンソールでデバッグ情報を確認

#### ✅ YAML解析のテスト
```javascript
// デバッグ用: expectedChangesが正しく読み込まれているか確認
console.log('Expected changes:', expectedChanges);
// 期待値: { deviceName: "PC-3", property: "config.ipAddress", ... }
```

### 3. デバッグとトラブルシューティング

#### ✅ 一般的なデバッグ手順
1. **ブラウザコンソールを開く** (F12 → Console)
2. **ファイルアップロード時のログを確認**
   - `expectedChanges`の内容
   - `targetDevice`の検索結果
   - `currentIP`の取得結果
   - `usedIPs`のリスト
3. **ネットワークシミュレータのJSONを手動確認**
   - 対象デバイスの`config.ipAddress`
   - 対象デバイスの`lan1.ipAddress`の一致確認

#### ✅ よくある問題パターンと解決方法

| 問題 | 症状 | 確認方法 | 解決方法 |
|------|------|----------|----------|
| `lan1.ipAddress`同期不備 | 正解のはずが不正解 | JSONで`config.ipAddress`と`lan1.ipAddress`を比較 | `syncLAN1Addresses()`で修正 |
| YAML解析エラー | `expectedChanges`が不完全 | コンソールで`expectedChanges`の内容確認 | YAML形式を単純なオブジェクト形式に変更 |
| 重複IP誤判定 | 同じIPが複数回カウント | `usedIPs`配列の内容確認 | 重複除去ロジックの修正 |
| パス解析エラー | `Cannot read properties of undefined` | `getNestedProperty`の引数確認 | プロパティパスの妥当性チェック |

### 4. 品質保証チェックポイント

#### ✅ リリース前の最終確認
- [ ] 複数のブラウザでテスト（Chrome, Firefox, Safari）
- [ ] モバイルデバイスでのテスト
- [ ] 異なるJSONファイル（正解・不正解）での動作確認
- [ ] エラーメッセージの分かりやすさ確認
- [ ] 学習効果の検証（実際に学習者がつまずくポイントの特定）

#### ✅ ドキュメント整備
- [ ] 課題の学習目標と解法の明文化
- [ ] 想定される学習時間の設定
- [ ] 解説文の充実（なぜその修正が必要なのか）
- [ ] 関連する他の課題との連携確認

---

## 緊急時の対応マニュアル

### 判定システムに問題が発覚した場合

1. **即座にデバッグモードを有効化**
   ```javascript
   // 問題演習システムにデバッグログを追加
   console.log('Debug info:', { expectedChanges, currentIP, usedIPs });
   ```

2. **ユーザーへの暫定対応**
   - 問題の acknowledgment
   - 代替手段の提示（手動確認など）
   - 修正予定時期の通知

3. **根本修正後の検証**
   - 同じ問題パターンで再テスト
   - 類似課題での横展開確認
   - リグレッションテストの実施

---

## 今後の改善提案

### システム設計面
1. **JSON schema validation**: 保存時にデータ整合性をチェック
2. **自動テストスイート**: 課題の動作を自動検証
3. **開発者向けプレビュー機能**: 課題作成者が事前に動作確認できる環境

### ユーザー体験面
1. **より詳細なエラーメッセージ**: 何が間違っているかを具体的に表示
2. **段階的ヒント機能**: 困ったときのガイダンス
3. **解答例の提供**: 正解のJSONファイルをダウンロード可能に

---

## 参考情報

- **関連ファイル**:
  - `/public/network-simulator/scripts/core/network-simulator.js` (シミュレータ本体)
  - `/src/pages/quiz/[unit].astro` (問題演習システム)
  - `/public/questions/network-troubleshooting/questions.yaml` (課題定義)

- **デバッグ用関数**:
  ```javascript
  // ブラウザコンソールで実行可能
  window.debugNetworkDevices();  // 全デバイス情報表示
  ```

---

*最終更新: 2025年9月16日*
*作成者: Claude (GitHub: anthropics/claude-code)*