# ネットワーク構築シミュレータ - 技術仕様書

## 概要

本シミュレータは、ネットワークの基本概念を視覚的に学習できるWebベースの教育ツールです。実際のネットワーク機器の配置、接続、設定、通信テストを体験できます。

## 主要機能

### 1. ネットワーク機器の配置と管理

#### 対応デバイス
- **PC**: エンドユーザーデバイス（クライアント）
- **サーバー**: サービス提供デバイス
- **ルーター**: 異なるネットワーク間の通信を中継
- **スイッチ**: 同一ネットワーク内のデバイス接続
- **ハブ**: レガシーな共有型接続デバイス

#### デバイス操作
- **ドラッグ&ドロップ**: パレットからキャンバスへのデバイス配置
- **クリック選択**: デバイスの選択とハイライト表示
- **削除機能**: パレットエリアへのドラッグで削除
- **設定変更**: 選択後の設定ダイアログ

### 2. ネットワーク接続機能

#### NIC（Network Interface Card）ベースの接続
- **統一ポート設計**: 入力/出力兼用のNICポート
- **1対1接続制限**: 各NICポートは1本の接続のみ
- **視覚的接続**: ベジェ曲線による美しい接続線
- **接続状態管理**: 使用中ポートの適切な管理

#### 接続操作
- **ドラッグ接続**: ポート間のドラッグで接続作成
- **スマート接続**: デバイスクリックで最適ポート自動選択
- **接続削除**: 接続線のダブルクリックで削除
- **一時接続線**: ドラッグ中のリアルタイム接続線表示

### 3. 高度なPing機能

#### ネットワーク層の実装
```javascript
// サブネット判定例
isInSameSubnet('192.168.1.100', '192.168.1.200', '255.255.255.0') // true
isInSameSubnet('192.168.1.100', '192.168.2.100', '255.255.255.0') // false
```

#### 通信可能性判定
1. **IPアドレス・サブネットマスク検証**
2. **同一サブネット内通信**: 直接通信可能
3. **異なるサブネット間通信**: ルーター必須
4. **デフォルトゲートウェイ検証**
5. **物理接続経路確認**

#### Pingアニメーション
- **経路追跡**: 実際の接続線に沿ったパケット移動
- **Request/Reply**: ICMP EchoリクエストとEcho応答の表現
- **RTT計測**: Round Trip Timeの測定と表示
- **エラー表現**: 失敗時の視覚的フィードバック

### 4. デバイス設定機能

#### 設定可能項目
```javascript
deviceConfig = {
    ipAddress: '192.168.1.100',      // IPアドレス
    subnetMask: '255.255.255.0',     // サブネットマスク  
    defaultGateway: '192.168.1.1'    // デフォルトゲートウェイ
}
```

#### 多様なデフォルト設定
- **PC**: 192.168.1.x, 192.168.2.x, 10.0.1.x, 172.16.1.x (循環)
- **サーバー**: 192.168.1.x, 192.168.10.x, 10.0.10.x (循環)
- **ルーター**: 192.168.1.x, 192.168.254.x, 10.0.0.x (循環)

## 技術実装詳細

### アーキテクチャ

#### フロントエンド
- **言語**: Vanilla JavaScript (ES6+)
- **描画**: HTML5 Canvas API
- **UI**: 純粋HTML/CSS（React未使用）
- **イベント処理**: 統一されたポインタイベント

#### データ構造
```javascript
// デバイス管理
devices: Map<string, Device>

// 接続管理  
connections: Array<{
    id: string,
    fromDevice: string,
    fromPort: string,
    toDevice: string,
    toPort: string,
    type: 'ethernet'
}>
```

### 主要クラス・関数

#### NetworkSimulator クラス
```javascript
class NetworkSimulator {
    constructor() {
        // 状態管理
        this.devices = new Map();
        this.connections = [];
        this.selectedDevice = null;
        this.isPingMode = false;
        
        // 描画関連
        this.canvas = null;
        this.ctx = null;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
    }
}
```

#### ネットワーク計算関数
```javascript
// IPアドレス操作
ipToInt(ip) // IPアドレスを32ビット整数に変換
intToIp(int) // 32ビット整数をIPアドレスに変換
getNetworkAddress(ip, subnet) // ネットワークアドレス計算
isInSameSubnet(ip1, ip2, subnet) // 同一サブネット判定

// 経路探索
findPath(sourceDevice, targetDevice) // BFS による最短経路探索
checkNetworkReachability(source, target) // ネットワーク到達性判定
```

#### アニメーション関数
```javascript
// パケットアニメーション
animatePacket(fromDevice, toDevice, label, color)
animatePingWithPath(sourceDevice, targetDevice, path)
animatePacketAlongPath(path, label, color)

// 接続線追跡
getConnectionPath(fromDevice, toDevice)
getPointOnCubicBezierCurve(t, startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY)
```

### レスポンシブ対応

#### デバイス判定
```javascript
isTouchDevice() {
    const isMobileWidth = window.innerWidth <= 1024;
    const hasTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const isPrimaryTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    return isMobileWidth && hasTouch && isPrimaryTouch;
}
```

#### 統一イベント処理
- マウス・タッチイベントの統一処理
- グローバルイベントリスナーによるキャンバス外ドラッグ対応
- ドラッグしきい値による クリック・ドラッグ判定分離

### パフォーマンス最適化

#### フレームレート制限
```javascript
scheduleRender() {
    if (this.renderScheduled) return;
    
    const now = performance.now();
    const timeSinceLastRender = now - this.lastRenderTime;
    
    if (timeSinceLastRender >= this.renderThrottle) {
        this.render();
        this.lastRenderTime = now;
    } else {
        this.renderScheduled = true;
        requestAnimationFrame(() => {
            this.renderScheduled = false;
            this.render();
            this.lastRenderTime = performance.now();
        });
    }
}
```

## 学習効果

### ネットワーク基礎概念
1. **物理層**: デバイス配置と物理接続
2. **データリンク層**: NICポートと1対1接続
3. **ネットワーク層**: IPアドレス、サブネットマスク、ルーティング
4. **アプリケーション層**: Pingコマンドの動作原理

### 実習可能シナリオ
- **同一セグメント通信**: PC間の直接通信
- **異なるセグメント通信**: ルーター経由通信
- **ネットワーク設定ミス**: サブネット不一致、ゲートウェイ設定エラー
- **物理接続問題**: ケーブル未接続、経路不通

## エラーハンドリング

### Ping失敗パターン
1. **無効なIPアドレス/サブネットマスク**
2. **異なるサブネット間でルーターなし**  
3. **デフォルトゲートウェイ設定エラー**
4. **物理接続経路なし**

### エラー表示機能
- **5秒間の詳細エラー表示**
- **失敗パケットアニメーション**（30%地点で停止）
- **デバイス赤色点滅**（3回）
- **具体的な修正指針の提供**

## 今後の拡張可能性

### 機能拡張
- **VLAN設定**: 仮想LAN の実装
- **ルーティングテーブル**: 複雑なルーティング設定
- **DHCP サーバー**: 動的IPアドレス割り当て
- **セキュリティ機能**: ファイアウォール、ACL

### プロトコル拡張
- **ARP**: アドレス解決プロトコル
- **DHCP**: 動的ホスト構成プロトコル
- **DNS**: ドメインネームシステム
- **HTTP/HTTPS**: Web通信プロトコル

## ファイル構成

```
/home/jun/joholife/
├── src/pages/network-simulator.astro    # メインページ
├── public/scripts/network-simulator.js  # メインロジック（1800行+）
└── network-simulator-documentation.md   # 本ドキュメント
```

## 開発指針

### コーディング規約
- **ES6+構文**: モダンJavaScript構文の活用
- **関数型プログラミング**: 純粋関数とイミュータブルデータ
- **統一命名規則**: camelCaseとsemantic naming
- **コメント**: 複雑なロジックには詳細な説明

### メンテナンス性
- **モジュール分割**: 機能ごとの明確な分離
- **状態管理**: 一元化された状態管理
- **エラーハンドリング**: 包括的なエラー処理
- **パフォーマンス**: 最適化された描画処理

---

**作成日**: 2024年
**開発者**: Claude + Human
**目的**: ネットワーク学習支援ツール