// ネットワークシミュレータクラス
class NetworkSimulator {
    constructor() {
        this.canvas = document.getElementById('network-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.devices = new Map();
        this.connections = [];
        this.selectedDevice = null;
        
        // アニメーションキューシステム
        this.animationQueue = [];
        this.isAnimationRunning = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.connectionStart = null;
        this.currentMousePos = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastPanPoint = null;
        this.touches = [];
        this.lastPinchDistance = null;
        this.lastPinchCenter = null;
        this.touchStartTime = 0;
        this.touchStartPos = null;
        this.dragThreshold = 10;
        this.selectedConnection = null;
        this.nextZIndex = 1;
        this.currentDeviceConfig = null;
        this.lastClickTime = 0;
        this.doubleClickDelay = 300;
        this.lastClickPosition = null;
        this.lastClickedDevice = null;
        
        // パレットスクロール対応
        this.isPaletteScrolling = false;
        this.paletteScrollStartX = 0;
        this.paletteScrollStartY = 0;
        this.paletteScrollThreshold = 10;
        this.paletteScrollStartScrollLeft = 0;
        this.pendingDeviceDrag = null;
        this.pendingDevice = null;
        this.dragStarted = false;
        
        // パフォーマンス最適化用
        this.renderScheduled = false;
        this.lastRenderTime = 0;
        this.renderThrottle = 16; // 60fps制限（16ms）
        
        // グローバルマウスハンドラをバインド
        this.globalMouseMoveHandler = this.handleGlobalMouseMove.bind(this);
        this.globalMouseUpHandler = this.handleGlobalMouseUp.bind(this);
        
        // ドラッグ終了時のスクリーン座標を記録
        this.lastDropScreenPos = { x: 0, y: 0 };
        
        // Pingモード関連
        this.isPingMode = false;
        this.pingSourceDevice = null;
        this.pingTargetDevice = null;
        
        // ドラッグ判定関連
        this.dragPrepared = false; // ドラッグ準備状態
        
        // エラー表示関連
        this.errorBlinkDevices = null; // エラー点滅中のデバイス
        
        // タッチ・マウスイベント重複防止
        this.lastTouchTime = 0;
        this.touchEventProcessed = false;
        
        this.init();
    }
    
    // タッチデバイスかどうかを判定
    isTouchDevice() {
        const isMobileWidth = window.innerWidth <= 1024;
        const hasTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
        const isPrimaryTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        return isMobileWidth && hasTouch && isPrimaryTouch;
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupPalette();
        this.render();
    }

    setupCanvas() {
        this.resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const dpr = window.devicePixelRatio || 1;
            
            this.canvas.width = container.clientWidth * dpr;
            this.canvas.height = container.clientHeight * dpr;
            this.canvas.style.width = container.clientWidth + 'px';
            this.canvas.style.height = container.clientHeight + 'px';
            
            this.ctx.scale(dpr, dpr);
            this.render();
        };

        window.addEventListener('resize', this.resizeCanvas);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.resizeCanvas();
            }, 100);
        });
        
        this.resizeCanvas();
    }

    setupEventListeners() {
        // マウスイベント
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        // グローバルマウスイベント（キャンバス外でのドラッグ対応）
        this.globalMouseMoveHandler = this.handleGlobalMouseMove.bind(this);
        this.globalMouseUpHandler = this.handleGlobalMouseUp.bind(this);

        // タッチイベント
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

        // ボタンイベント
        document.getElementById('clear-btn').addEventListener('click', this.clearAll.bind(this));
        document.getElementById('ping-btn').addEventListener('click', this.startPing.bind(this));
        document.getElementById('config-btn').addEventListener('click', this.showDeviceConfig.bind(this));

        // ファイル関連イベント
        document.getElementById('save-network-btn').addEventListener('click', this.saveNetwork.bind(this));
        document.getElementById('load-network-btn').addEventListener('click', this.loadNetwork.bind(this));
        document.getElementById('export-network-btn').addEventListener('click', this.exportImage.bind(this));
        document.getElementById('file-input').addEventListener('change', this.handleFileLoad.bind(this));

        // ダイアログイベント
        document.getElementById('cancel-btn').addEventListener('click', this.hideDeviceConfig.bind(this));
        document.getElementById('save-btn').addEventListener('click', this.saveDeviceConfig.bind(this));
        document.getElementById('dialog-overlay').addEventListener('click', this.hideDeviceConfig.bind(this));
    }

    setupPalette() {
        const palette = document.querySelector('.device-palette');
        const items = palette.querySelectorAll('.device-item');
        const isTouchDevice = this.isTouchDevice();
        const isNarrowScreen = window.innerWidth <= 1024;
        
        console.log('Device detection:', {
            isTouchDevice: isTouchDevice,
            isNarrowScreen: isNarrowScreen,
            width: window.innerWidth,
            hasTouch: ('ontouchstart' in window || navigator.maxTouchPoints > 0),
            primaryTouch: window.matchMedia('(hover: none) and (pointer: coarse)').matches
        });
        
        // タッチデバイス＋狭い画面の場合のみスクロール処理を追加
        if (isTouchDevice && isNarrowScreen) {
            console.log('Setting up touch scroll handlers (touch device + narrow screen)');
            const paletteContent = document.querySelector('.palette-content');
            if (paletteContent) {
                paletteContent.addEventListener('touchstart', this.handlePaletteScrollStart.bind(this), { passive: false });
                paletteContent.addEventListener('touchmove', this.handlePaletteScrollMove.bind(this), { passive: false });
                paletteContent.addEventListener('touchend', this.handlePaletteScrollEnd.bind(this), { passive: false });
            }
        }
        
        // すべての環境でデバイスドラッグを有効化
        console.log('Setting up device drag handlers for all environments');
        items.forEach(item => {
            item.addEventListener('mousedown', this.startDeviceDrag.bind(this));
            // すべての環境でタッチイベントを有効化（パッシブでない）
            item.addEventListener('touchstart', this.startDeviceDrag.bind(this), { passive: false });
        });
    }

    // パレットスクロール処理（論理回路シミュレータと同じ）
    handlePaletteScrollStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.paletteScrollStartX = touch.clientX;
            this.paletteScrollStartY = touch.clientY;
            this.paletteScrollStartScrollLeft = e.currentTarget.scrollLeft;
            this.isPaletteScrolling = false;
            this.pendingDeviceDrag = null;
        }
    }

    handlePaletteScrollMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - this.paletteScrollStartX);
            const deltaY = Math.abs(touch.clientY - this.paletteScrollStartY);
            
            // 移動判定の改善：縦方向の移動が大きい場合はデバイスドラッグを優先
            if (deltaX > this.paletteScrollThreshold || deltaY > this.paletteScrollThreshold) {
                // デバイスドラッグ待機中の場合
                if (this.pendingDeviceDrag) {
                    console.log('Evaluating movement: deltaY:', deltaY, 'deltaX:', deltaX, 'deltaY > deltaX:', deltaY > deltaX);
                    // デバイスドラッグ判定を緩く（斜め移動も含む）
                    if ((deltaY > 12 || deltaX > 12) && deltaY > 8) {
                        console.log('🔽 Starting device drag (vertical movement), deltaY:', deltaY, 'deltaX:', deltaX);
                        this.startActualDeviceDrag(this.pendingDeviceDrag.type, e);
                        this.pendingDeviceDrag = null;
                        return; // スクロール処理は実行しない
                    }
                    // 横方向の移動が大きい場合は常にスクロール優先
                    else if (deltaX > 8) { // スクロール検出範囲を緩く
                        this.isPaletteScrolling = true;
                        console.log('◀️▶️ Palette scroll activated (horizontal movement)! deltaX:', deltaX);
                        this.pendingDeviceDrag = null;
                    }
                }
            }
            
            // パレットスクロール処理
            if (this.isPaletteScrolling) {
                const scrollDelta = this.paletteScrollStartX - touch.clientX;
                e.currentTarget.scrollLeft = this.paletteScrollStartScrollLeft + scrollDelta;
                e.preventDefault();
            }
        }
    }

    handlePaletteScrollEnd(e) {
        this.isPaletteScrolling = false;
        this.pendingDeviceDrag = null;
    }

    // デバイスドラッグ開始（論理回路シミュレータの実装を正確に模倣）
    startDeviceDrag(event) {
        event.preventDefault();
        console.log('startDeviceDrag called with type:', event.currentTarget.dataset.deviceType);
        
        // スクロール判定をスキップしてタッチ操作を改善
        const isTouchDevice = this.isTouchDevice();
        const isNarrowScreen = window.innerWidth <= 1024;
        console.log('isTouchDevice:', isTouchDevice, 'isNarrowScreen:', isNarrowScreen);
        
        // タッチ操作を常に有効化（スクロール判定をスキップ）
        console.log('Device drag starting immediately for better touch support');
        
        // デスクトップ環境または広い画面時：即座にドラッグ開始
        this.isPaletteScrolling = false;
        const deviceType = event.currentTarget.dataset.deviceType;
        
        // パレットアイテムの場合は、適切なキャンバス座標にデバイスを作成
        let x, y;
        const canvasRect = this.canvas.getBoundingClientRect();
        
        if (event.type === 'touchstart' && event.touches && event.touches.length > 0) {
            // タッチの場合
            const touch = event.touches[0];
            console.log('Touch position:', touch.clientX, touch.clientY);
            console.log('Canvas rect:', canvasRect);
            
            // タッチ位置がキャンバス内かチェック
            const isWithinCanvas = touch.clientX >= canvasRect.left && touch.clientX <= canvasRect.right &&
                                 touch.clientY >= canvasRect.top && touch.clientY <= canvasRect.bottom;
            
            if (isWithinCanvas) {
                // キャンバス内の場合、その座標を使用
                x = (touch.clientX - canvasRect.left - this.panX) / this.scale;
                y = (touch.clientY - canvasRect.top - this.panY) / this.scale;
                console.log('Touch within canvas, using touch position:', x, y);
            } else {
                // キャンバス外の場合、中央に配置
                x = (canvasRect.width / 2 - this.panX) / this.scale;
                y = (canvasRect.height / 2 - this.panY) / this.scale;
                console.log('Touch outside canvas, using center position:', x, y);
            }
        } else {
            // マウスの場合、キャンバス中央に配置
            x = (canvasRect.width / 2 - this.panX) / this.scale;
            y = (canvasRect.height / 2 - this.panY) / this.scale;
            console.log('Mouse event, using center position:', x, y);
        }
        
        const device = this.createDevice(deviceType, x, y);
        device.isNewFromPalette = true; // パレットから作成されたことを記録
        
        // 重要：まだマップには追加せず、一時的に保持
        this.pendingDevice = device;
        this.selectedDevice = device;
        this.isDragging = true;
        
        // タッチ操作でのドラッグオフセットを適切に設定
        if (event.type === 'touchstart' && event.touches && event.touches.length > 0) {
            const touch = event.touches[0];
            this.dragOffset = { 
                x: device.width / 2,  // デバイス中央でドラッグ
                y: device.height / 2
            };
        } else {
            this.dragOffset = { x: 0, y: 0 };
        }
        
        this.dragStarted = false; // 実際のドラッグが開始されたかのフラグ
        
        // タッチイベントの場合、グローバルなイベントリスナーを追加
        if (event.type === 'touchstart') {
            this.setupGlobalTouchHandlers();
        } else {
            // マウスイベントの場合
            document.addEventListener('mousemove', this.globalMouseMoveHandler);
            document.addEventListener('mouseup', this.globalMouseUpHandler);
        }
        
        console.log('Device prepared for drag, not yet visible:', device.type);
    }


    // デバイス表示名を取得
    getDeviceDisplayName(deviceType) {
        const names = {
            'pc': 'PC',
            'router': 'ルーター',
            'switch': 'スイッチ',
            'server': 'サーバー',
            'hub': 'ハブ'
        };
        return names[deviceType] || deviceType;
    }


    // デバイスのデフォルトIP取得
    getDefaultIP(type, count) {
        // デバイスタイプごとに異なるサブネットを使用してテストしやすくする
        const configs = {
            'pc': {
                subnets: ['192.168.1.', '192.168.2.', '10.0.1.', '172.16.1.'],
                start: 100
            },
            'server': {
                subnets: ['192.168.1.', '192.168.10.', '10.0.10.'],
                start: 50
            },
            'router': {
                subnets: ['192.168.1.', '192.168.254.', '10.0.0.'],
                start: 1
            },
            'switch': {
                subnets: ['192.168.1.'],
                start: 10
            },
            'hub': {
                subnets: ['192.168.1.'],
                start: 20
            }
        };
        
        const config = configs[type] || configs['pc'];
        const subnetIndex = (count - 1) % config.subnets.length;
        const subnet = config.subnets[subnetIndex];
        const hostNumber = config.start + Math.floor((count - 1) / config.subnets.length);
        
        return subnet + hostNumber;
    }

    // LAN2のデフォルトIP取得
    getLAN2DefaultIP(type, count) {
        if (type !== 'router') return '192.168.2.1';
        
        const routerIP = this.getDefaultIP(type, count);
        const parts = routerIP.split('.');
        return `${parts[0]}.${parts[1]}.2.1`;
    }

    // LAN3のデフォルトIP取得
    getLAN3DefaultIP(type, count) {
        if (type !== 'router') return '192.168.3.1';
        
        const routerIP = this.getDefaultIP(type, count);
        const parts = routerIP.split('.');
        return `${parts[0]}.${parts[1]}.3.1`;
    }

    // DHCPプール開始アドレス取得（LAN番号対応）
    getDHCPPoolStart(type, count, lanNumber = 1) {
        if (type !== 'router') return '192.168.1.100';
        
        const routerIP = this.getDefaultIP(type, count);
        const parts = routerIP.split('.');
        return `${parts[0]}.${parts[1]}.${lanNumber}.100`;
    }

    // DHCPプール終了アドレス取得（LAN番号対応）
    getDHCPPoolEnd(type, count, lanNumber = 1) {
        if (type !== 'router') return '192.168.1.199';
        
        const routerIP = this.getDefaultIP(type, count);
        const parts = routerIP.split('.');
        return `${parts[0]}.${parts[1]}.${lanNumber}.199`;
    }

    // デバイスのNICポート情報を取得（入出力兼用）
    getDevicePorts(type) {
        const portConfigs = {
            'pc': {
                nics: [{ id: 'eth', label: 'ETH', x: 1, y: 0.5, isDynamic: true }]
            },
            'server': {
                nics: [{ id: 'eth', label: 'ETH', x: 0, y: 0.5, isDynamic: true }]
            },
            'router': {
                nics: [
                    { id: 'wan', label: 'WAN', x: 0, y: 0.3 },
                    { id: 'lan1', label: 'LAN1', x: 0, y: 0.7 },
                    { id: 'lan2', label: 'LAN2', x: 1, y: 0.3 },
                    { id: 'lan3', label: 'LAN3', x: 1, y: 0.7 }
                ]
            },
            'switch': {
                nics: [
                    { id: 'port1', label: 'P1', x: 0, y: 0.15 },
                    { id: 'port2', label: 'P2', x: 0, y: 0.35 },
                    { id: 'port3', label: 'P3', x: 0, y: 0.55 },
                    { id: 'port4', label: 'P4', x: 0, y: 0.75 },
                    { id: 'port5', label: 'P5', x: 1, y: 0.15 },
                    { id: 'port6', label: 'P6', x: 1, y: 0.35 },
                    { id: 'port7', label: 'P7', x: 1, y: 0.55 },
                    { id: 'port8', label: 'P8', x: 1, y: 0.75 }
                ]
            },
            'hub': {
                nics: [
                    { id: 'port1', label: 'P1', x: 0, y: 0.25 },
                    { id: 'port2', label: 'P2', x: 0, y: 0.75 },
                    { id: 'port3', label: 'P3', x: 1, y: 0.25 },
                    { id: 'port4', label: 'P4', x: 1, y: 0.75 }
                ]
            }
        };
        return portConfigs[type] || { nics: [] };
    }

    // 単一NICデバイスかどうかを判定
    isSingleNICDevice(device) {
        return device.type === 'pc' || device.type === 'server';
    }

    // 線と矩形の交点を計算
    getLineRectIntersection(x1, y1, x2, y2, rectX, rectY, rectWidth, rectHeight) {
        const intersections = [];
        
        // 上辺との交点
        const topY = rectY;
        if ((y1 <= topY && y2 >= topY) || (y1 >= topY && y2 <= topY)) {
            const t = (topY - y1) / (y2 - y1);
            const intersectX = x1 + t * (x2 - x1);
            if (intersectX >= rectX && intersectX <= rectX + rectWidth) {
                intersections.push({ x: intersectX, y: topY, side: 'top' });
            }
        }
        
        // 下辺との交点
        const bottomY = rectY + rectHeight;
        if ((y1 <= bottomY && y2 >= bottomY) || (y1 >= bottomY && y2 <= bottomY)) {
            const t = (bottomY - y1) / (y2 - y1);
            const intersectX = x1 + t * (x2 - x1);
            if (intersectX >= rectX && intersectX <= rectX + rectWidth) {
                intersections.push({ x: intersectX, y: bottomY, side: 'bottom' });
            }
        }
        
        // 左辺との交点
        const leftX = rectX;
        if ((x1 <= leftX && x2 >= leftX) || (x1 >= leftX && x2 <= leftX)) {
            const t = (leftX - x1) / (x2 - x1);
            const intersectY = y1 + t * (y2 - y1);
            if (intersectY >= rectY && intersectY <= rectY + rectHeight) {
                intersections.push({ x: leftX, y: intersectY, side: 'left' });
            }
        }
        
        // 右辺との交点
        const rightX = rectX + rectWidth;
        if ((x1 <= rightX && x2 >= rightX) || (x1 >= rightX && x2 <= rightX)) {
            const t = (rightX - x1) / (x2 - x1);
            const intersectY = y1 + t * (y2 - y1);
            if (intersectY >= rectY && intersectY <= rectY + rectHeight) {
                intersections.push({ x: rightX, y: intersectY, side: 'right' });
            }
        }
        
        return intersections;
    }

    // 動的NICポート位置を更新
    updateDynamicNICPosition(device) {
        if (!this.isSingleNICDevice(device)) return;
        
        const nic = device.ports.nics[0];
        if (!nic.connected) return;
        
        const connection = nic.connected;
        let otherDevice = null;
        let otherPort = null;
        
        // 接続先デバイスとポートを特定
        if (connection.from.device === device) {
            otherDevice = connection.to.device;
            otherPort = connection.to.port;
        } else {
            otherDevice = connection.from.device;
            otherPort = connection.from.port;
        }
        
        if (!otherDevice || !otherPort) return;
        
        // 接続先ポートの実際の座標を計算
        const otherPortX = otherDevice.x + otherPort.x * otherDevice.width;
        const otherPortY = otherDevice.y + otherPort.y * otherDevice.height;
        
        // デバイス中央から接続先ポートへの線と、デバイスの輪郭との交点を計算
        const deviceCenterX = device.x + device.width / 2;
        const deviceCenterY = device.y + device.height / 2;
        
        const intersections = this.getLineRectIntersection(
            deviceCenterX, deviceCenterY,
            otherPortX, otherPortY,
            device.x, device.y, device.width, device.height
        );
        
        if (intersections.length > 0) {
            // 最も適切な交点を選択（接続先に近い方）
            let bestIntersection = intersections[0];
            let minDistance = Infinity;
            
            for (const intersection of intersections) {
                const distance = Math.sqrt(
                    Math.pow(intersection.x - otherPortX, 2) + 
                    Math.pow(intersection.y - otherPortY, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    bestIntersection = intersection;
                }
            }
            
            // NICポートの位置を更新（相対座標で保存）
            nic.x = (bestIntersection.x - device.x) / device.width;
            nic.y = (bestIntersection.y - device.y) / device.height;
            nic.side = bestIntersection.side;
        }
    }

    // 座標変換
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.panX) / this.scale,
            y: (screenY - this.panY) / this.scale
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.scale + this.panX,
            y: worldY * this.scale + this.panY
        };
    }

    // ポインタ位置取得（キャンバス座標系）
    getPointerPos(event) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        return {
            x: (clientX - rect.left - this.panX) / this.scale,
            y: (clientY - rect.top - this.panY) / this.scale
        };
    }
    
    // ドラッグ用の拡張座標取得（キャンバス外も許可）
    getDragPointerPos(event) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        // キャンバス外でも動作するように座標変換
        return {
            x: (clientX - rect.left - this.panX) / this.scale,
            y: (clientY - rect.top - this.panY) / this.scale,
            screenX: clientX,
            screenY: clientY
        };
    }

    // グローバルマウス移動処理（論理回路シミュレータと同じ）
    handleGlobalMouseMove(event) {
        if (this.isDragging && this.selectedDevice) {
            // キャンバス外でもマウス位置を取得してデバイスを移動
            this.handlePointerMove(event);
        }
    }
    
    // 統一されたポインタ移動処理
    handlePointerMove(event) {
        // デバイスドラッグ中は拡張座標を使用（キャンバス外も許可）
        const pos = this.isDragging && this.selectedDevice ? 
                   this.getDragPointerPos(event) : this.getPointerPos(event);
        this.currentMousePos = { x: pos.x, y: pos.y };
        
        // ドラッグ準備状態からの移行判定
        if (this.dragPrepared && this.selectedDevice && !this.isDragging) {
            // ドラッグ開始位置からの移動距離を計算
            const startX = this.touchStartPos.x;
            const startY = this.touchStartPos.y;
            const distance = Math.sqrt((pos.x - startX) ** 2 + (pos.y - startY) ** 2);
            
            // ドラッグしきい値を超えた場合、実際のドラッグモードに入る
            if (distance > this.dragThreshold) {
                this.isDragging = true;
                this.dragPrepared = false;
                console.log('ドラッグ開始:', this.selectedDevice.name);
            }
        }
        
        if (this.isDragging && this.selectedDevice) {
            // パレットから作成されたデバイスで、まだマップに追加されていない場合
            if (this.pendingDevice && !this.dragStarted) {
                console.log('First drag movement detected, adding device to map:', this.pendingDevice.type);
                this.devices.set(this.pendingDevice.id, this.pendingDevice);
                this.dragStarted = true;
            }
            
            this.selectedDevice.x = pos.x - this.dragOffset.x;
            this.selectedDevice.y = pos.y - this.dragOffset.y;
        } else if (this.isPanning && this.lastPanPoint) {
            // パン処理：スクリーン座標で計算
            const rect = this.canvas.getBoundingClientRect();
            const currentScreenX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : this.lastPanPoint.screenX);
            const currentScreenY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : this.lastPanPoint.screenY);
            
            const deltaX = currentScreenX - this.lastPanPoint.screenX;
            const deltaY = currentScreenY - this.lastPanPoint.screenY;
            
            this.panX += deltaX;
            this.panY += deltaY;
            
            this.lastPanPoint.screenX = currentScreenX;
            this.lastPanPoint.screenY = currentScreenY;
        }
        
        this.scheduleRender();
    }
    
    // フレーム制限付き描画スケジューラ
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

    // グローバルマウスアップ処理（パレット用）
    handleGlobalMouseUp(event) {
        // ドロップ位置のスクリーン座標を記録
        this.lastDropScreenPos = {
            x: event.clientX || 0,
            y: event.clientY || 0
        };
        
        // パレットからのドラッグ処理
        if (this.pendingDevice || this.isDragging) {
            this.finalizeDrag();
        }
        
        // グローバルリスナーを削除
        if (this.paletteMouseMoveHandler) {
            document.removeEventListener('mousemove', this.paletteMouseMoveHandler);
            this.paletteMouseMoveHandler = null;
        }
        if (this.paletteMouseUpHandler) {
            document.removeEventListener('mouseup', this.paletteMouseUpHandler);
            this.paletteMouseUpHandler = null;
        }
        
        console.log('Removed global event listeners for palette drag');
    }

    // グローバルタッチ移動処理
    handleGlobalTouchMove(event) {
        if (this.isDragging && this.selectedDevice) {
            const pos = this.getDragPointerPos(event);
            this.selectedDevice.x = pos.x - this.dragOffset.x;
            this.selectedDevice.y = pos.y - this.dragOffset.y;
            this.currentMousePos = { x: pos.x, y: pos.y };
            this.scheduleRender();
        }
    }

    // グローバルタッチエンド処理
    handleGlobalTouchEnd(event) {
        // ドロップ位置のスクリーン座標を記録
        if (event.changedTouches && event.changedTouches.length > 0) {
            const touch = event.changedTouches[0];
            this.lastDropScreenPos = {
                x: touch.clientX || 0,
                y: touch.clientY || 0
            };
        }
        
        this.finalizeDrag();
    }

    // デバイス作成（論理回路シミュレータのcreateComponentと同じ役割）
    createDevice(deviceType, x, y) {
        const id = `${deviceType}-${Date.now()}`;
        const deviceCount = Array.from(this.devices.values()).filter(d => d.type === deviceType).length + 1;
        
        return {
            id,
            type: deviceType,
            name: `${this.getDeviceDisplayName(deviceType)}-${deviceCount}`,
            x: x,
            y: y,
            width: 80,
            height: 70,
            config: {
                ipAddress: this.getDefaultIP(deviceType, deviceCount),
                subnetMask: '255.255.255.0',
                defaultGateway: '192.168.1.1',
                dhcpEnabled: false,
                // 複数LAN対応のDHCP設定
                lan1: {
                    ipAddress: this.getDefaultIP(deviceType, deviceCount),
                    dhcpEnabled: deviceType === 'router',
                    dhcpPoolStart: this.getDHCPPoolStart(deviceType, deviceCount, 1),
                    dhcpPoolEnd: this.getDHCPPoolEnd(deviceType, deviceCount, 1),
                    dhcpAllocatedIPs: new Map()
                },
                lan2: {
                    ipAddress: this.getLAN2DefaultIP(deviceType, deviceCount),
                    dhcpEnabled: false,
                    dhcpPoolStart: this.getDHCPPoolStart(deviceType, deviceCount, 2),
                    dhcpPoolEnd: this.getDHCPPoolEnd(deviceType, deviceCount, 2),
                    dhcpAllocatedIPs: new Map()
                },
                lan3: {
                    ipAddress: this.getLAN3DefaultIP(deviceType, deviceCount),
                    dhcpEnabled: false,
                    dhcpPoolStart: this.getDHCPPoolStart(deviceType, deviceCount, 3),
                    dhcpPoolEnd: this.getDHCPPoolEnd(deviceType, deviceCount, 3),
                    dhcpAllocatedIPs: new Map()
                },
                dhcpLeaseTime: 3600,
                // 後方互換性のための旧設定（LAN1と同期）
                dhcpServerEnabled: deviceType === 'router',
                dhcpPoolStart: this.getDHCPPoolStart(deviceType, deviceCount, 1),
                dhcpPoolEnd: this.getDHCPPoolEnd(deviceType, deviceCount, 1),
                dhcpAllocatedIPs: new Map()
            },
            zIndex: this.nextZIndex++,
            ports: this.getDevicePorts(deviceType)
        };
    }
    
    // 実際のデバイスドラッグ開始（狭い画面用）
    startActualDeviceDrag(deviceType, event) {
        console.log('startActualDeviceDrag called with:', deviceType);
        
        // パレットアイテムの場合は、適切なキャンバス座標にデバイスを作成
        let x, y;
        const canvasRect = this.canvas.getBoundingClientRect();
        
        if (event.touches && event.touches.length > 0) {
            const touch = event.touches[0];
            // タッチ位置がキャンバス内かチェック
            const isWithinCanvas = touch.clientX >= canvasRect.left && touch.clientX <= canvasRect.right &&
                                 touch.clientY >= canvasRect.top && touch.clientY <= canvasRect.bottom;
            
            if (isWithinCanvas) {
                x = (touch.clientX - canvasRect.left - this.panX) / this.scale;
                y = (touch.clientY - canvasRect.top - this.panY) / this.scale;
            } else {
                x = (canvasRect.width / 2 - this.panX) / this.scale;
                y = (canvasRect.height / 2 - this.panY) / this.scale;
            }
        } else {
            x = (canvasRect.width / 2 - this.panX) / this.scale;
            y = (canvasRect.height / 2 - this.panY) / this.scale;
        }
        
        const device = this.createDevice(deviceType, x, y);
        device.isNewFromPalette = true;
        
        this.pendingDevice = device;
        this.selectedDevice = device;
        this.isDragging = true;
        this.dragOffset = { x: 0, y: 0 };
        this.dragStarted = false;
        
        // グローバルタッチハンドラーを設定
        this.setupGlobalTouchHandlers();
        
        console.log('Actual device drag started:', device.type);
    }
    
    // グローバルタッチハンドラーの設定
    setupGlobalTouchHandlers() {
        // グローバルなタッチムーブとタッチエンドイベントを追加
        const handleGlobalTouchMove = (event) => {
            if (this.isDragging) {
                event.preventDefault();
                this.handlePointerMove(event);
            }
        };
        
        const handleGlobalTouchEnd = (event) => {
            if (this.isDragging) {
                event.preventDefault();
                this.handlePointerUp(event);
            }
            // イベントリスナーを削除
            document.removeEventListener('touchmove', handleGlobalTouchMove);
            document.removeEventListener('touchend', handleGlobalTouchEnd);
        };
        
        document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
        document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    }

    // パレットエリアの座標範囲を取得
    getPaletteRect() {
        const palette = document.querySelector('.device-palette');
        if (palette) {
            return palette.getBoundingClientRect();
        }
        return null;
    }
    
    // スクリーン座標がパレットエリア内かチェック
    isInPaletteArea(screenX, screenY) {
        const paletteRect = this.getPaletteRect();
        if (!paletteRect) return false;
        
        return screenX >= paletteRect.left && 
               screenX <= paletteRect.right && 
               screenY >= paletteRect.top && 
               screenY <= paletteRect.bottom;
    }

    // ドラッグ完了処理（論理回路シミュレータと同じロジック）
    finalizeDrag() {
        // パレットから作成されたデバイスで、実際のドラッグが開始されていない場合
        if (this.pendingDevice && !this.dragStarted) {
            this.pendingDevice = null;
            this.selectedDevice = null;
            this.isDragging = false;
            return;
        }
        
        // 新規デバイス配置（パレットからドラッグ）
        if (this.pendingDevice && this.dragStarted) {
            // ドロップ位置がパレットエリア内かチェック
            if (this.isInPaletteArea(this.lastDropScreenPos.x, this.lastDropScreenPos.y)) {
                // パレットエリアにドロップされた場合は削除
                console.log('New device dropped in palette area - removing');
                this.devices.delete(this.pendingDevice.id);
                this.updateStatus('デバイス配置をキャンセルしました');
            } else {
                // 正常配置
                this.updateStatus(`${this.pendingDevice.name}を配置しました`);
            }
            this.updateControlButtons();
        }
        
        // 既存デバイスのドラッグ完了 - 削除判定（論理回路シミュレータと同じ）
        if (this.selectedDevice && this.isDragging && !this.pendingDevice) {
            // パレットエリアにドロップされた場合は削除
            if (this.isInPaletteArea(this.lastDropScreenPos.x, this.lastDropScreenPos.y)) {
                console.log('Existing device dropped in palette area - removing');
                
                // デバイスに関連する接続を削除
                this.connections = this.connections.filter(conn => 
                    conn.fromDevice !== this.selectedDevice.id && 
                    conn.toDevice !== this.selectedDevice.id
                );
                
                // デバイスを削除
                this.devices.delete(this.selectedDevice.id);
                this.updateStatus(`${this.selectedDevice.name}を削除しました`);
                this.updateControlButtons();
            }
        }
        
        // ドラッグ終了時に、接続されている単一NICデバイスのポート位置を更新
        if (this.selectedDevice && this.isSingleNICDevice(this.selectedDevice)) {
            this.updateDynamicNICPosition(this.selectedDevice);
            
            // 接続先デバイスも単一NICなら更新
            const nic = this.selectedDevice.ports.nics[0];
            if (nic.connected) {
                const connection = nic.connected;
                const otherDevice = connection.from.device === this.selectedDevice ? 
                    connection.to.device : connection.from.device;
                if (this.isSingleNICDevice(otherDevice)) {
                    this.updateDynamicNICPosition(otherDevice);
                }
            }
        }

        // クリーンアップ
        this.isDragging = false;
        this.dragPrepared = false;
        this.pendingDevice = null;
        this.dragStarted = false;
        this.selectedDevice = null;
        
        // グローバルイベントリスナーを削除
        if (this.globalMouseMoveHandler) {
            document.removeEventListener('mousemove', this.globalMouseMoveHandler);
            document.removeEventListener('mouseup', this.globalMouseUpHandler);
        }
        
        this.scheduleRender();
    }

    // マウスイベント処理（論理回路シミュレータ風）
    handleMouseDown(e) {
        e.preventDefault();
        
        // タッチイベント由来でない場合のみ重複チェック
        if (e.type !== 'touchstart') {
            // タッチイベントの直後にマウスイベントが発生した場合はスキップ（iOS対応）
            const currentTime = Date.now();
            if (this.touchEventProcessed && currentTime - this.lastTouchTime < 100) {
                console.log('重複マウスイベントをスキップ:', currentTime - this.lastTouchTime, 'ms後');
                return;
            }
        }
        
        const pos = this.getPointerPos(e);
        
        this.touchStartTime = Date.now();
        this.touchStartPos = { x: pos.x, y: pos.y };
        this.currentMousePos = { x: pos.x, y: pos.y };
        this.lastClickPosition = pos;
        
        // 1. 端子を優先チェック（接続開始の意図を尊重）
        const port = this.getPortAt(pos.x, pos.y);
        if (port) {
            this.startConnection(port);
            return;
        }
        
        // 2. 接続線をチェック
        const connection = this.getConnectionAt(pos.x, pos.y);
        if (connection) {
            const currentTime = Date.now();
            
            if (this.selectedConnection === connection &&
                currentTime - this.lastClickTime < this.doubleClickDelay) {
                // ダブルクリック：接続線を削除
                this.removeConnection(connection.id);
                this.selectedConnection = null;
                this.updateStatus('接続線を削除しました');
                this.scheduleRender();
                return;
            }
            
            // シングルクリック：接続線を選択
            this.selectedConnection = connection;
            this.selectedDevice = null;
            this.lastClickTime = currentTime;
            this.updateStatus(`接続線を選択しました`);
            this.scheduleRender();
            return;
        }
        
        // 3. デバイスをチェック
        const device = this.getDeviceAt(pos.x, pos.y);
        if (device) {
            // Pingモードの場合は特別な処理
            if (this.isPingMode) {
                this.handlePingDeviceSelection(device);
                return;
            }
            
            this.selectedDevice = device;
            this.selectedConnection = null;
            
            // ドラッグ準備状態（実際のドラッグは移動が検出されてから開始）
            this.isDragging = false; // 最初はドラッグモードではない
            this.dragPrepared = true; // ドラッグ準備状態
            this.dragOffset = {
                x: pos.x - device.x,
                y: pos.y - device.y
            };
            this.updateStatus(`${device.name}を選択しました`);
            
            // グローバルマウスリスナーを追加（キャンバス外でのドラッグ対応）
            document.addEventListener('mousemove', this.globalMouseMoveHandler);
            document.addEventListener('mouseup', this.globalMouseUpHandler);
        } else {
            // 4. 空白エリアをクリック
            this.selectedDevice = null;
            this.selectedConnection = null;
            this.dragPrepared = false; // ドラッグ準備状態をリセット
            this.isPanning = true;
            
            // パン開始位置をスクリーン座標で記録
            const screenX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const screenY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
            this.lastPanPoint = { 
                screenX: screenX, 
                screenY: screenY 
            };
            
            // 接続をキャンセル
            if (this.connectionStart) {
                this.connectionStart = null;
                this.updateStatus('接続をキャンセルしました');
            }
        }
        
        this.updateControlButtons();
        this.scheduleRender();
    }

    handleMouseMove(e) {
        const pos = this.getPointerPos(e);
        this.currentMousePos = { x: pos.x, y: pos.y };
        this.handlePointerMove(e);
    }

    handleMouseUp(e) {
        this.handlePointerUp(e);
    }
    
    // グローバルマウス移動処理
    handleGlobalMouseMove(e) {
        if (this.isDragging && this.selectedDevice) {
            // 統一処理を使用
            this.handlePointerMove(e);
        }
    }
    
    // グローバルマウスアップ処理
    handleGlobalMouseUp(e) {
        this.handlePointerUp(e);
        
        // グローバルリスナーを削除
        document.removeEventListener('mousemove', this.globalMouseMoveHandler);
        document.removeEventListener('mouseup', this.globalMouseUpHandler);
    }
    
    // 統一されたポインタアップ処理
    handlePointerUp(e) {
        const pos = this.getPointerPos(e);
        
        // ドロップ位置のスクリーン座標を記録
        if (e.clientX !== undefined && e.clientY !== undefined) {
            this.lastDropScreenPos = { x: e.clientX, y: e.clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            this.lastDropScreenPos = { x: touch.clientX, y: touch.clientY };
        }
        
        // 接続中の場合
        if (this.connectionStart) {
            let port = this.getPortAt(pos.x, pos.y);
            
            // 直接端子が見つからない場合、スマート接続を試行
            if (!port) {
                const device = this.getDeviceAt(pos.x, pos.y);
                if (device) {
                    port = this.findBestPort(device, this.connectionStart);
                }
            }
            
            if (port && port !== this.connectionStart) {
                this.completeConnection(this.connectionStart, port);
            }
            
            this.connectionStart = null;
            this.scheduleRender();
        }
        
        // デバイスのドラッグ終了時の処理（finalizeDragで統一）
        if (this.isDragging && (this.selectedDevice || this.pendingDevice)) {
            this.finalizeDrag();
        } else if (this.dragPrepared && this.selectedDevice) {
            // ドラッグされずに終了した場合（単純なクリックまたはダブルクリック）
            this.handleDeviceClick(this.selectedDevice);
        }
        
        // 残りのクリーンアップ
        this.isDragging = false;
        this.dragPrepared = false; // ドラッグ準備状態をリセット
        this.isPanning = false;
        this.lastPanPoint = null;
    }

    // タッチイベント処理
    handleTouchStart(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            
            // タッチを擬似的なマウスイベントに変換
            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                touches: [touch],
                preventDefault: () => e.preventDefault(),
                type: 'touchstart' // タッチイベント由来であることを示す
            };
            
            this.handleMouseDown(syntheticEvent);
            
            // マウスダウン処理後にタッチイベント処理フラグを設定
            this.lastTouchTime = Date.now();
            this.touchEventProcessed = true;
            
            // 一定時間後にフラグをリセット
            setTimeout(() => {
                this.touchEventProcessed = false;
            }, 200);
        } else if (e.touches.length === 2) {
            // ピンチズーム開始
            this.isPanning = false; // ピンチ中はパンを無効化
            this.lastPinchDistance = this.getPinchDistance(e.touches);
            this.lastPinchCenter = this.getPinchCenter(e.touches);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && !this.lastPinchDistance) {
            const touch = e.touches[0];
            
            // タッチを擬似的なマウスイベントに変換
            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                touches: [touch],
                preventDefault: () => e.preventDefault()
            };
            
            // currentMousePosを更新
            const pos = this.getPointerPos(syntheticEvent);
            this.currentMousePos = { x: pos.x, y: pos.y };
            
            this.handleMouseMove(syntheticEvent);
        } else if (e.touches.length === 2 && this.lastPinchDistance) {
            // ピンチズーム処理
            const currentDistance = this.getPinchDistance(e.touches);
            const currentCenter = this.getPinchCenter(e.touches);
            
            const scaleChange = currentDistance / this.lastPinchDistance;
            const newScale = Math.max(0.5, Math.min(3, this.scale * scaleChange));
            
            if (newScale !== this.scale) {
                const rect = this.canvas.getBoundingClientRect();
                const centerX = currentCenter.x - rect.left;
                const centerY = currentCenter.y - rect.top;
                
                this.panX = centerX - (centerX - this.panX) * (newScale / this.scale);
                this.panY = centerY - (centerY - this.panY) * (newScale / this.scale);
                this.scale = newScale;
            }
            
            this.lastPinchDistance = currentDistance;
            this.lastPinchCenter = currentCenter;
            this.scheduleRender();
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        
        if (e.touches.length === 0) {
            // タッチエンドをマウスアップとして処理
            const touch = e.changedTouches && e.changedTouches[0];
            if (touch) {
                const syntheticEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    changedTouches: [touch],
                    preventDefault: () => e.preventDefault()
                };
                this.handlePointerUp(syntheticEvent);
            }
            
            this.lastPinchDistance = null;
            this.lastPinchCenter = null;
        } else if (e.touches.length === 1) {
            this.lastPinchDistance = null;
            this.lastPinchCenter = null;
        }
    }

    // ピンチズーム用ヘルパー
    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getPinchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }

    // ホイールズーム
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.5, Math.min(3, this.scale * scaleFactor));
        
        if (newScale !== this.scale) {
            this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
            this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
            this.scale = newScale;
            this.scheduleRender();
        }
    }

    // 指定座標のデバイス取得
    getDeviceAt(x, y) {
        // Z-indexの高い順（手前から）にチェック
        const sortedDevices = Array.from(this.devices.values())
            .sort((a, b) => b.zIndex - a.zIndex);
        
        for (const device of sortedDevices) {
            if (x >= device.x && x <= device.x + device.width &&
                y >= device.y && y <= device.y + device.height) {
                return device;
            }
        }
        return null;
    }
    
    // 指定座標の接続線取得
    getConnectionAt(x, y) {
        const tolerance = 8;
        
        for (const connection of this.connections) {
            let fromDevice, toDevice, fromPortId, toPortId;
            
            // 新しい形式（from/to オブジェクト）と古い形式の両方をサポート
            if (connection.from && connection.to) {
                // 新しい形式
                fromDevice = connection.from.device;
                toDevice = connection.to.device;
                fromPortId = connection.from.port.id;
                toPortId = connection.to.port.id;
            } else {
                // 古い形式（後方互換性）
                fromDevice = this.devices.get(connection.fromDevice);
                toDevice = this.devices.get(connection.toDevice);
                fromPortId = connection.fromPort;
                toPortId = connection.toPort;
            }
            
            if (!fromDevice || !toDevice) continue;
            
            const fromPort = this.getPortPosition(fromDevice, fromPortId);
            const toPort = this.getPortPosition(toDevice, toPortId);
            
            if (!fromPort || !toPort) continue;
            
            // 線分と点の距離を計算
            const distance = this.pointToLineDistance(x, y, fromPort.x, fromPort.y, toPort.x, toPort.y);
            
            if (distance <= tolerance) {
                return connection;
            }
        }
        
        return null;
    }
    
    // 点と線分の距離を計算
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        let param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // スマート接続用の最適ポート検索（NIC用・1対1制限）
    findBestPort(device, startPort) {
        const ports = device.ports;
        if (!ports || !ports.nics) return null;
        
        // 未使用のNICポートのみを探す（1対1制限）
        for (const port of ports.nics) {
            // 既に使用されているかチェック
            const isUsed = this.connections.some(conn =>
                (conn.fromDevice === device.id && conn.fromPort === port.id) ||
                (conn.toDevice === device.id && conn.toPort === port.id)
            );
            
            if (!isUsed) {
                return { device, port, type: 'nic' };
            }
        }
        
        // 全ポートが使用中の場合はnullを返す（多重接続禁止）
        return null;
    }
    
    // 接続線削除
    removeConnection(connectionId) {
        const connectionIndex = this.connections.findIndex(c => c.id === connectionId);
        if (connectionIndex === -1) return;
        
        const connection = this.connections[connectionIndex];
        
        // 接続されているポートの接続情報をクリア
        if (connection.from && connection.to) {
            // 新しい形式
            connection.from.port.connected = null;
            connection.to.port.connected = null;
        } else {
            // 古い形式の場合は、デバイスとポートを検索してクリア
            const fromDevice = this.devices.get(connection.fromDevice);
            const toDevice = this.devices.get(connection.toDevice);
            
            if (fromDevice) {
                const fromPort = fromDevice.ports.nics.find(p => p.id === connection.fromPort);
                if (fromPort) fromPort.connected = null;
            }
            
            if (toDevice) {
                const toPort = toDevice.ports.nics.find(p => p.id === connection.toPort);
                if (toPort) toPort.connected = null;
            }
        }
        
        this.connections.splice(connectionIndex, 1);
        console.log('接続線削除:', connectionId);
    }
    
    // デバイス削除
    removeDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;
        
        // このデバイスに関連する接続線をすべて削除
        const connectionsToRemove = this.connections.filter(conn =>
            conn.fromDevice === deviceId || conn.toDevice === deviceId
        );
        
        connectionsToRemove.forEach(conn => {
            this.removeConnection(conn.id);
        });
        
        // デバイスを削除
        this.devices.delete(deviceId);
        console.log('デバイス削除:', deviceId);
        
        this.updateControlButtons();
        this.scheduleRender();
    }
    
    // 作業領域外かどうかをチェック
    isOutsideWorkArea(x, y) {
        // キャンバスの実際の表示領域を取得
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;
        
        // ワールド座標での作業領域を計算（削除用の広いマージン）
        const deleteMargin = 100; // 削除判定のマージン（広め）
        const worldBounds = {
            left: -this.panX / this.scale - deleteMargin,
            top: -this.panY / this.scale - deleteMargin,
            right: (canvasWidth - this.panX) / this.scale + deleteMargin,
            bottom: (canvasHeight - this.panY) / this.scale + deleteMargin
        };
        
        return x < worldBounds.left || x > worldBounds.right ||
               y < worldBounds.top || y > worldBounds.bottom;
    }



    // 接続開始（1対1制限チェック付き）
    startConnection(port) {
        // 1対1制限：開始ポートが既に使用中かチェック
        if (port.port.connected) {
            this.updateStatus(`${port.device.name}の${port.port.label}は既に接続されています`);
            return;
        }
        
        this.connectionStart = port;
        this.updateStatus(`${port.device.name}の${port.port.label}ポートから接続を開始しました`);
        console.log('接続開始:', port.type, 'on', port.device.type);
    }
    
    // 接続完了（NIC間接続・1対1制限）
    completeConnection(startPort, endPort) {
        console.log('接続完了試行:', startPort.type, '->', endPort.type);
        
        // 接続の妥当性をチェック
        if (startPort.device === endPort.device) {
            this.updateStatus('同じデバイス内のポート間は接続できません');
            return;
        }
        
        // 1対1制限：開始ポートが既に接続されているかチェック
        if (startPort.port.connected) {
            this.updateStatus(`${startPort.device.name}の${startPort.port.label}は既に接続されています`);
            return;
        }
        
        // 1対1制限：終了ポートが既に接続されているかチェック
        if (endPort.port.connected) {
            this.updateStatus(`${endPort.device.name}の${endPort.port.label}は既に接続されています`);
            return;
        }
        
        // NIC間接続作成（1対1接続）
        const connection = {
            id: 'conn_' + Date.now(),
            from: { device: startPort.device, port: startPort.port },
            to: { device: endPort.device, port: endPort.port },
            type: 'ethernet',
            selected: false
        };
        
        // ポートに接続情報を設定
        startPort.port.connected = connection;
        endPort.port.connected = connection;
        
        this.connections.push(connection);
        
        // 単一NICデバイスの場合、動的NICポート位置を更新
        this.updateDynamicNICPosition(startPort.device);
        this.updateDynamicNICPosition(endPort.device);
        
        this.updateStatus(`${startPort.device.name}の${startPort.port.label} と ${endPort.device.name}の${endPort.port.label} を接続しました`);
        console.log('接続作成完了:', connection.id);
    }

    // 指定座標のNICポートを取得
    getPortAt(x, y) {
        const tolerance = 15; // ポートのクリック許容範囲
        
        // Z-index順（最前面から背面）でデバイスを取得
        const sortedDevices = Array.from(this.devices.values())
            .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
        
        // tolerance内の全ポートを収集
        const portsWithinTolerance = [];
        
        for (const device of sortedDevices) {
            const ports = device.ports;
            if (!ports || !ports.nics) continue;
            
            // NICポートをチェック
            for (const port of ports.nics) {
                const portX = device.x + port.x * device.width;
                const portY = device.y + port.y * device.height;
                const distance = Math.sqrt((x - portX) ** 2 + (y - portY) ** 2);
                
                if (distance <= tolerance) {
                    portsWithinTolerance.push({
                        device, port, type: 'nic',
                        portX, portY, distance
                    });
                }
            }
        }
        
        if (portsWithinTolerance.length === 0) {
            return null;
        }
        
        // 複数のポートが範囲内にある場合の選択ロジック
        if (portsWithinTolerance.length > 1) {
            // 1. 最前面のデバイスのポートを優先
            const maxZIndex = Math.max(...portsWithinTolerance.map(p => p.device.zIndex || 0));
            const topMostPorts = portsWithinTolerance.filter(p => (p.device.zIndex || 0) === maxZIndex);
            
            // 2. 距離で選択
            const bestPort = topMostPorts.reduce((best, current) =>
                current.distance < best.distance ? current : best
            );
            
            return { device: bestPort.device, port: bestPort.port, type: bestPort.type };
        }
        
        const foundPort = portsWithinTolerance[0];
        return { device: foundPort.device, port: foundPort.port, type: foundPort.type };
    }


    // すべてクリア
    clearAll() {
        this.devices.clear();
        this.connections = [];
        this.selectedDevice = null;
        this.selectedConnection = null;
        this.connectionStart = null;
        this.nextZIndex = 1;
        
        this.updateControlButtons();
        this.updateStatus('すべてクリアしました');
        this.scheduleRender();
    }

    // Ping実行（新しい視覚的インターフェース）
    startPing() {
        if (this.devices.size < 2) {
            this.updateStatus('Pingには少なくとも2台のデバイスが必要です');
            return;
        }
        
        if (!this.isPingMode) {
            // Pingモード開始
            this.isPingMode = true;
            this.pingSourceDevice = null;
            this.pingTargetDevice = null;
            this.selectedDevice = null; // 選択をリセット
            this.updateStatus('🎯 Ping送信元のデバイスをクリックしてください');
            this.updateControlButtons();
            this.scheduleRender();
        } else {
            // Pingモード終了
            this.exitPingMode();
        }
    }
    
    // Pingモード終了
    exitPingMode() {
        this.isPingMode = false;
        this.pingSourceDevice = null;
        this.pingTargetDevice = null;
        this.updateStatus('Pingモードを終了しました');
        this.updateControlButtons();
        this.scheduleRender();
    }
    
    // Pingを実行
    async executePing() {
        if (!this.pingSourceDevice || !this.pingTargetDevice) {
            return;
        }
        
        // ネットワーク到達性チェック
        const reachabilityResult = this.checkNetworkReachability(this.pingSourceDevice, this.pingTargetDevice);
        if (!reachabilityResult.isReachable) {
            await this.showPingError(reachabilityResult.reason, this.pingSourceDevice, this.pingTargetDevice);
            return;
        }
        
        // 物理的な接続経路をチェック
        const path = this.findPath(this.pingSourceDevice, this.pingTargetDevice);
        if (path.length === 0) {
            await this.showPingError('デバイス間に物理接続経路がありません', this.pingSourceDevice, this.pingTargetDevice);
            return;
        }
        
        this.updateStatus(`🚀 Ping送信中: ${this.pingSourceDevice.name}(${this.pingSourceDevice.config.ipAddress}) → ${this.pingTargetDevice.name}(${this.pingTargetDevice.config.ipAddress})`);
        
        // Pingパケットアニメーション
        await this.animatePingWithPath(this.pingSourceDevice, this.pingTargetDevice, path);
        
        // Pingモードを継続（再度選択可能）
        this.pingSourceDevice = null;
        this.pingTargetDevice = null;
        this.updateStatus('🎯 Ping送信元のデバイスをクリックしてください');
        this.scheduleRender();
    }

    // ネットワーク到達性チェック
    checkNetworkReachability(sourceDevice, targetDevice) {
        const sourceIP = sourceDevice.config.ipAddress;
        const sourceSubnet = sourceDevice.config.subnetMask;
        const sourceGateway = sourceDevice.config.defaultGateway;
        
        const targetIP = targetDevice.config.ipAddress;
        const targetSubnet = targetDevice.config.subnetMask;
        const targetGateway = targetDevice.config.defaultGateway;
        
        // IPアドレスの有効性チェック
        if (!this.isValidIP(sourceIP) || !this.isValidIP(targetIP)) {
            return { isReachable: false, reason: '無効なIPアドレスが設定されています' };
        }
        
        if (!this.isValidIP(sourceSubnet) || !this.isValidIP(targetSubnet)) {
            return { isReachable: false, reason: '無効なサブネットマスクが設定されています' };
        }
        
        // 両方向での直接通信可能性をチェック
        if (this.canCommunicateDirectly(sourceIP, sourceSubnet, targetIP, targetSubnet)) {
            // 両方向で同一サブネット内なら直接通信可能
            return { 
                isReachable: true, 
                reason: '同一サブネット内での直接通信',
                routingType: 'direct'
            };
        }
        
        // 異なるサブネット間では、ルーターが必要
        // 詳細なサブネット不一致理由を取得
        const subnetMismatchReason = this.getSubnetMismatchReason(sourceIP, sourceSubnet, targetIP, targetSubnet);
        
        // 経路上にルーターがあるかチェック
        const path = this.findPath(sourceDevice, targetDevice);
        const hasRouter = path.some(device => device.type === 'router');
        
        if (!hasRouter) {
            return { 
                isReachable: false, 
                reason: `${subnetMismatchReason}のためルーターが必要です`
            };
        }
        
        // ゲートウェイ設定チェック
        if (!this.isValidIP(sourceGateway)) {
            return { 
                isReachable: false, 
                reason: `送信元デバイスのデフォルトゲートウェイが無効です: ${sourceGateway}`
            };
        }
        
        // ゲートウェイがルーターの範囲内にあるかチェック
        const gatewayReachable = this.isGatewayReachable(sourceDevice, path);
        if (!gatewayReachable.isReachable) {
            return { 
                isReachable: false, 
                reason: gatewayReachable.reason
            };
        }
        
        // ルーター経由の場合は成功
        const sourceNetwork = this.getNetworkAddress(sourceIP, sourceSubnet);
        const targetNetwork = this.getNetworkAddress(targetIP, targetSubnet);
        return { 
            isReachable: true, 
            reason: `ルーター経由での通信 (${sourceNetwork} → ${targetNetwork})`,
            routingType: 'routed'
        };
    }
    
    // IPアドレスを32ビット整数に変換
    ipToInt(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }
    
    // 32ビット整数をIPアドレスに変換
    intToIp(int) {
        return [(int >>> 24), (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    }
    
    // ネットワークアドレスを計算
    getNetworkAddress(ip, subnet) {
        const ipInt = this.ipToInt(ip);
        const subnetInt = this.ipToInt(subnet);
        const networkInt = ipInt & subnetInt;
        return this.intToIp(networkInt);
    }
    
    // ブロードキャストアドレスを計算
    getBroadcastAddress(ip, subnet) {
        const ipInt = this.ipToInt(ip);
        const subnetInt = this.ipToInt(subnet);
        const wildcardInt = ~subnetInt >>> 0;
        const broadcastInt = (ipInt & subnetInt) | wildcardInt;
        return this.intToIp(broadcastInt);
    }
    
    // 同一サブネット内かチェック（単一サブネットマスク）
    isInSameSubnet(ip1, ip2, subnet) {
        const network1 = this.getNetworkAddress(ip1, subnet);
        const network2 = this.getNetworkAddress(ip2, subnet);
        return network1 === network2;
    }
    
    // 両方向のサブネット判定（より厳密）
    canCommunicateDirectly(sourceIP, sourceSubnet, targetIP, targetSubnet) {
        // 送信元から見て送信先が同一サブネット内か
        const sourceCanReachTarget = this.isInSameSubnet(sourceIP, targetIP, sourceSubnet);
        
        // 送信先から見て送信元が同一サブネット内か
        const targetCanReachSource = this.isInSameSubnet(targetIP, sourceIP, targetSubnet);
        
        // 両方向で通信可能な場合のみ直接通信可能
        return sourceCanReachTarget && targetCanReachSource;
    }
    
    // 詳細なサブネット不一致の理由を取得
    getSubnetMismatchReason(sourceIP, sourceSubnet, targetIP, targetSubnet) {
        const sourceNetwork = this.getNetworkAddress(sourceIP, sourceSubnet);
        const targetNetwork = this.getNetworkAddress(targetIP, targetSubnet);
        const sourceCIDR = this.subnetMaskToCIDR(sourceSubnet);
        const targetCIDR = this.subnetMaskToCIDR(targetSubnet);
        
        const sourceCanReachTarget = this.isInSameSubnet(sourceIP, targetIP, sourceSubnet);
        const targetCanReachSource = this.isInSameSubnet(targetIP, sourceIP, targetSubnet);
        
        if (!sourceCanReachTarget && !targetCanReachSource) {
            return `異なるネットワーク (送信元: ${sourceNetwork}/${sourceCIDR}, 送信先: ${targetNetwork}/${targetCIDR})`;
        } else if (!sourceCanReachTarget) {
            return `送信元のサブネットマスク/${sourceCIDR}では送信先に到達できません (${sourceNetwork}/${sourceCIDR} → ${targetIP})`;
        } else if (!targetCanReachSource) {
            return `送信先のサブネットマスク/${targetCIDR}では応答できません (${targetNetwork}/${targetCIDR} ← ${sourceIP})`;
        }
        
        return '不明なサブネット不一致';
    }
    
    // サブネットマスクをCIDR表記に変換
    subnetMaskToCIDR(subnetMask) {
        const subnetInt = this.ipToInt(subnetMask);
        // 1のビット数を数える
        let cidr = 0;
        let mask = subnetInt;
        while (mask) {
            cidr += mask & 1;
            mask >>>= 1;
        }
        return cidr;
    }
    
    // ゲートウェイへの到達可能性チェック
    isGatewayReachable(sourceDevice, path) {
        const sourceIP = sourceDevice.config.ipAddress;
        const sourceSubnet = sourceDevice.config.subnetMask;
        const gateway = sourceDevice.config.defaultGateway;
        
        // ゲートウェイが同一サブネット内にあるかチェック
        if (!this.isInSameSubnet(sourceIP, gateway, sourceSubnet)) {
            return {
                isReachable: false,
                reason: `デフォルトゲートウェイ ${gateway} が同一サブネット内にありません`
            };
        }
        
        // 経路上のルーターがゲートウェイアドレスを持っているかチェック
        const routers = path.filter(device => device.type === 'router');
        const gatewayFound = routers.some(router => {
            return router.config.ipAddress === gateway;
        });
        
        if (!gatewayFound) {
            return {
                isReachable: false,
                reason: `デフォルトゲートウェイ ${gateway} に対応するルーターが見つかりません`
            };
        }
        
        return { isReachable: true, reason: 'ゲートウェイへの到達可能' };
    }

    // Pingエラーの詳細表示
    async showPingError(reason, sourceDevice, targetDevice) {
        // エラーメッセージの詳細情報を作成
        const errorDetails = [
            `❌ Ping失敗`,
            `送信元: ${sourceDevice.name} (${sourceDevice.config.ipAddress})`,
            `送信先: ${targetDevice.name} (${targetDevice.config.ipAddress})`,
            `理由: ${reason}`
        ];
        
        // 失敗理由に応じたアニメーション
        await this.animatePingErrorByReason(reason, sourceDevice, targetDevice);
        
        // 詳細エラーメッセージを表示
        this.updateStatus(errorDetails.join(' | '));
        
        // エラーメッセージを5秒間表示してから次の操作を促す
        await this.sleep(5000);
        
        // Pingモードを継続（再度選択可能）
        this.pingSourceDevice = null;
        this.pingTargetDevice = null;
        this.updateStatus('🎯 Ping送信元のデバイスをクリックしてください（前回のPingは失敗しました）');
        this.scheduleRender();
    }
    
    // 失敗理由に応じたPingエラーアニメーション
    async animatePingErrorByReason(reason, sourceDevice, targetDevice) {
        try {
            this.updateStatus(`🚀 Ping送信中: ${sourceDevice.config.ipAddress} → ${targetDevice.config.ipAddress}`);
            
            // 失敗理由に応じてパケットがどこまで到達するかを決定
            const path = this.findPath(sourceDevice, targetDevice);
            const reachableHops = this.calculateReachableHopsForFailure(reason, sourceDevice, targetDevice, path);
            
            // 到達可能な地点までパケットを移動
            if (reachableHops > 1) {
                // スイッチなどの中継機器まで到達
                for (let i = 0; i < reachableHops - 1; i++) {
                    await this.animatePacket(path[i], path[i + 1], '🔴 ICMP Request', '#f44336');
                    await this.sleep(200);
                }
                
                // 最終到達地点で失敗表示
                await this.sleep(300);
                this.updateStatus(`❌ Ping失敗: ${path[reachableHops - 1].name}で通信が停止`);
                await this.blinkDevicesRed([path[reachableHops - 1]]);
            } else {
                // 送信元から出られない場合
                this.updateStatus(`❌ Ping失敗: ${sourceDevice.name}から送信できません`);
                await this.blinkDevicesRed([sourceDevice]);
            }
            
            await this.sleep(1000);
            
        } catch (error) {
            console.log('Error animation failed:', error);
        }
    }
    
    // Pingエラーアニメーション（後方互換性のため保持）
    async animatePingError(sourceDevice, targetDevice) {
        // 失敗したパケットのアニメーション
        try {
            // エラー表示用の赤いパケットを実際の経路に沿って動かしてから停止
            this.updateStatus(`🚀 Ping送信中... ${sourceDevice.config.ipAddress} → ${targetDevice.config.ipAddress}`);
            
            // 実際の経路を取得
            const path = this.findPath(sourceDevice, targetDevice);
            
            // 経路に沿った失敗アニメーション
            if (path.length > 0) {
                await this.animateFailedPacketAlongPath(path);
            } else {
                // 経路がない場合は従来の直線アニメーション
                await this.animateFailedPacket(sourceDevice, targetDevice);
            }
            
            // デバイスを赤く点滅させる
            await this.blinkDevicesRed([sourceDevice, targetDevice]);
            
        } catch (error) {
            console.log('Error animation failed:', error);
        }
    }
    
    // 経路に沿った失敗パケットのアニメーション
    async animateFailedPacketAlongPath(path) {
        if (path.length < 2) return;
        
        const sourceDevice = path[0];
        const targetDevice = path[path.length - 1];
        
        // ネットワーク到達性をチェックして、実際にパケットがどこまで進むかを計算
        const reachableHops = this.calculateReachableHops(sourceDevice, targetDevice, path);
        
        if (reachableHops === 0) {
            // 送信元デバイス自体から送信できない場合
            await this.animateLocalFailure(sourceDevice);
            return;
        }
        
        // 到達可能な地点まで正常に進む
        for (let i = 0; i < reachableHops - 1; i++) {
            await this.animatePacket(path[i], path[i + 1], '🔴 ICMP Request', '#f44336');
            await this.sleep(200);
        }
        
        // 最終的に失敗する箇所で30%地点まで進んで停止
        if (reachableHops < path.length) {
            await this.animateFailedPacketSegment(path[reachableHops - 1], path[reachableHops]);
        }
    }
    
    // 失敗理由に応じて、パケットがどこまで到達可能かを計算
    calculateReachableHopsForFailure(reason, sourceDevice, targetDevice, path) {
        const sourceIP = sourceDevice.config.ipAddress;
        const sourceSubnet = sourceDevice.config.subnetMask;
        const sourceGateway = sourceDevice.config.defaultGateway;
        const targetIP = targetDevice.config.ipAddress;
        
        // IP設定が無効な場合：送信元から出られない
        if (reason.includes('無効なIPアドレス') || reason.includes('無効なサブネットマスク')) {
            return 1; // 送信元デバイスのみ
        }
        
        // デフォルトゲートウェイ設定エラー：同一サブネット内のスイッチまでは到達可能
        if (reason.includes('デフォルトゲートウェイが無効') || reason.includes('ゲートウェイ')) {
            // 両方向で同一サブネット内なら直接通信できるので、最初のスイッチまで到達
            if (path.length > 1 && this.canCommunicateDirectly(sourceIP, sourceSubnet, targetIP, targetDevice.config.subnetMask)) {
                return Math.min(2, path.length); // 最初のスイッチまで
            }
            return 1; // 異なるサブネットなら送信元から出られない
        }
        
        // 物理接続がない場合：送信元から出られない
        if (reason.includes('物理接続経路がありません')) {
            return 1;
        }
        
        // ルーターが必要だが存在しない場合：同一サブネット内のスイッチまで到達
        if (reason.includes('ルーターが必要') || reason.includes('異なるサブネット')) {
            // 最初のスイッチ（非ルーター）まで到達
            for (let i = 1; i < path.length; i++) {
                if (path[i].type === 'switch' || path[i].type === 'hub') {
                    return i + 1; // スイッチまで到達
                }
                if (path[i].type === 'router') {
                    return i; // ルーターの手前まで
                }
            }
            return Math.min(2, path.length); // 最低でも次のホップまで
        }
        
        // その他のエラー：送信元から出られない
        return 1;
    }
    
    // ネットワーク制約を考慮して、パケットがどこまで到達可能かを計算
    calculateReachableHops(sourceDevice, targetDevice, path) {
        const sourceIP = sourceDevice.config.ipAddress;
        const sourceSubnet = sourceDevice.config.subnetMask;
        const sourceGateway = sourceDevice.config.defaultGateway;
        
        const targetIP = targetDevice.config.ipAddress;
        const targetSubnet = targetDevice.config.subnetMask;
        
        // 同一サブネット内の場合
        if (this.isInSameSubnet(sourceIP, targetIP, sourceSubnet)) {
            // 直接通信可能な場合は、最初の中継機器（スイッチ等）まで到達
            return Math.min(2, path.length); // 送信元→次のホップまで
        }
        
        // 異なるサブネット間の場合
        // デフォルトゲートウェイが設定されていない場合
        if (!this.isValidIP(sourceGateway)) {
            return 1; // 送信元デバイスから出られない
        }
        
        // デフォルトゲートウェイが同一サブネット内にない場合
        if (!this.isInSameSubnet(sourceIP, sourceGateway, sourceSubnet)) {
            return 1; // 送信元デバイスから出られない
        }
        
        // ルーターが経路上にない場合
        const hasRouter = path.some(device => device.type === 'router');
        if (!hasRouter) {
            // 最初のスイッチまでは到達するが、その先に進めない
            const firstRouterOrEnd = path.findIndex((device, index) => 
                index > 0 && (device.type === 'router' || index === path.length - 1)
            );
            return Math.max(1, firstRouterOrEnd);
        }
        
        // ルーターがある場合、ルーターまで到達
        const routerIndex = path.findIndex((device, index) => 
            index > 0 && device.type === 'router'
        );
        
        if (routerIndex !== -1) {
            return routerIndex + 1; // ルーターの次まで
        }
        
        return 1; // フォールバック：送信元から最初のホップまで
    }
    
    // 送信元デバイスでのローカル失敗アニメーション
    async animateLocalFailure(sourceDevice) {
        // 送信元デバイス付近で小さくアニメーション
        const packet = {
            x: sourceDevice.x + sourceDevice.width / 2,
            y: sourceDevice.y + sourceDevice.height / 2,
            targetX: sourceDevice.x + sourceDevice.width / 2 + 20,
            targetY: sourceDevice.y + sourceDevice.height / 2 - 20,
            label: '❌ 送信失敗',
            color: '#f44336',
            progress: 0
        };
        
        const duration = 800;
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                packet.progress = Math.min(elapsed / duration, 1);
                
                const actualProgress = Math.min(packet.progress / 0.2, 1); // 20%まで移動
                
                packet.x = sourceDevice.x + sourceDevice.width / 2 + 
                          (packet.targetX - (sourceDevice.x + sourceDevice.width / 2)) * actualProgress;
                packet.y = sourceDevice.y + sourceDevice.height / 2 + 
                          (packet.targetY - (sourceDevice.y + sourceDevice.height / 2)) * actualProgress;
                
                this.renderWithPacket(packet);
                
                if (packet.progress < 0.2) {
                    requestAnimationFrame(animate);
                } else {
                    this.render();
                    resolve();
                }
            };
            
            animate();
        });
    }
    
    // セグメント内での失敗パケットアニメーション（30%地点で停止）
    async animateFailedPacketSegment(fromDevice, toDevice) {
        return new Promise((resolve) => {
            const packet = {
                x: fromDevice.x + fromDevice.width / 2,
                y: fromDevice.y + fromDevice.height / 2,
                targetX: toDevice.x + toDevice.width / 2,
                targetY: toDevice.y + toDevice.height / 2,
                label: '❌ FAILED',
                color: '#f44336',
                progress: 0
            };
            
            const duration = 1000;
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                packet.progress = Math.min(elapsed / duration, 1);
                
                // 30%の地点で停止
                const stopProgress = 0.3;
                const actualProgress = Math.min(packet.progress / stopProgress, 1);
                
                packet.x = fromDevice.x + fromDevice.width / 2 + 
                          (packet.targetX - (fromDevice.x + fromDevice.width / 2)) * actualProgress;
                packet.y = fromDevice.y + fromDevice.height / 2 + 
                          (packet.targetY - (fromDevice.y + fromDevice.height / 2)) * actualProgress;
                
                this.renderWithPacket(packet);
                
                if (packet.progress < stopProgress) {
                    requestAnimationFrame(animate);
                } else {
                    // パケットを消去して停止
                    this.render();
                    resolve();
                }
            };
            
            animate();
        });
    }
    
    // 失敗パケットのアニメーション（従来版：直線）
    async animateFailedPacket(fromDevice, toDevice) {
        return new Promise((resolve) => {
            const packet = {
                x: fromDevice.x + fromDevice.width / 2,
                y: fromDevice.y + fromDevice.height / 2,
                targetX: toDevice.x + toDevice.width / 2,
                targetY: toDevice.y + toDevice.height / 2,
                label: '❌ FAILED',
                color: '#f44336',
                progress: 0
            };
            
            const duration = 1000;
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                packet.progress = Math.min(elapsed / duration, 1);
                
                // 途中で停止（失敗を表現）
                const stopProgress = 0.3; // 30%の地点で停止
                const actualProgress = Math.min(packet.progress / stopProgress, 1);
                
                packet.x = fromDevice.x + fromDevice.width / 2 + 
                          (packet.targetX - (fromDevice.x + fromDevice.width / 2)) * actualProgress;
                packet.y = fromDevice.y + fromDevice.height / 2 + 
                          (packet.targetY - (fromDevice.y + fromDevice.height / 2)) * actualProgress;
                
                this.renderWithPacket(packet);
                
                if (packet.progress < stopProgress) {
                    requestAnimationFrame(animate);
                } else {
                    // パケットを消去して停止
                    this.render();
                    resolve();
                }
            };
            
            animate();
        });
    }
    
    // デバイスを赤く点滅
    async blinkDevicesRed(devices) {
        for (let i = 0; i < 3; i++) { // 3回点滅
            // 赤く表示
            this.errorBlinkDevices = new Set(devices.map(d => d.id));
            this.scheduleRender();
            await this.sleep(200);
            
            // 元に戻す
            this.errorBlinkDevices = null;
            this.scheduleRender();
            await this.sleep(200);
        }
    }

    // Pingモードでのデバイス選択処理
    handlePingDeviceSelection(device) {
        if (!this.pingSourceDevice) {
            // 送信元デバイスを選択
            this.pingSourceDevice = device;
            this.updateStatus(`🔵 送信元: ${device.name} | 送信先のデバイスをクリックしてください`);
        } else if (!this.pingTargetDevice && device !== this.pingSourceDevice) {
            // 送信先デバイスを選択
            this.pingTargetDevice = device;
            this.updateStatus(`🔴 送信先: ${device.name} | Ping実行中...`);
            // 自動的にPingを実行
            setTimeout(() => this.executePing(), 500);
        } else if (device === this.pingSourceDevice) {
            // 送信元デバイスを再選択
            this.pingSourceDevice = null;
            this.pingTargetDevice = null;
            this.updateStatus('🎯 Ping送信元のデバイスをクリックしてください');
        }
        
        this.scheduleRender();
    }
    
    // デバイス間の経路を検索（BFS）
    findPath(sourceDevice, targetDevice) {
        if (sourceDevice === targetDevice) return [sourceDevice];
        
        const visited = new Set();
        const queue = [[sourceDevice]];
        visited.add(sourceDevice.id);
        
        while (queue.length > 0) {
            const path = queue.shift();
            const currentDevice = path[path.length - 1];
            
            // 現在のデバイスの接続をチェック
            for (const conn of this.connections) {
                let nextDevice = null;
                
                if (conn.fromDevice === currentDevice.id) {
                    nextDevice = this.devices.get(conn.toDevice);
                } else if (conn.toDevice === currentDevice.id) {
                    nextDevice = this.devices.get(conn.fromDevice);
                }
                
                if (nextDevice && !visited.has(nextDevice.id)) {
                    const newPath = [...path, nextDevice];
                    
                    if (nextDevice === targetDevice) {
                        return newPath;
                    }
                    
                    visited.add(nextDevice.id);
                    queue.push(newPath);
                }
            }
        }
        
        return []; // 経路が見つからない
    }

    // 接続されたデバイスを取得
    getConnectedDevices(device) {
        const connected = [];
        for (const connection of this.connections) {
            if (connection.device1 === device.id) {
                const connectedDevice = this.devices.get(connection.device2);
                if (connectedDevice) connected.push(connectedDevice);
            } else if (connection.device2 === device.id) {
                const connectedDevice = this.devices.get(connection.device1);
                if (connectedDevice) connected.push(connectedDevice);
            }
        }
        return connected;
    }

    // 経路ベースのPingアニメーション
    async animatePingWithPath(sourceDevice, targetDevice, path) {
        try {
            const startTime = Date.now();
            
            // ネットワーク情報を取得
            const sourceNetwork = this.getNetworkAddress(sourceDevice.config.ipAddress, sourceDevice.config.subnetMask);
            const targetNetwork = this.getNetworkAddress(targetDevice.config.ipAddress, targetDevice.config.subnetMask);
            const isSameSubnet = sourceNetwork === targetNetwork;
            const routingType = isSameSubnet ? '直接通信' : 'ルーター経由';
            
            // 経路情報を生成
            const routeInfo = path.map(device => `${device.name}(${device.config.ipAddress})`).join(' → ');
            
            // ICMP Request（送信元 → 送信先）
            this.updateStatus(`🚀 ICMP Request送信: ${sourceDevice.config.ipAddress} → ${targetDevice.config.ipAddress} (${routingType})`);
            await this.queuedAnimatePacketAlongPath(path, '🔵 ICMP Request', '#2196f3');
            
            await this.sleep(300);
            
            // ICMP Reply（送信先 → 送信元）
            this.updateStatus(`⬅️ ICMP Reply受信: ${targetDevice.config.ipAddress} → ${sourceDevice.config.ipAddress}`);
            const reversePath = [...path].reverse();
            await this.queuedAnimatePacketAlongPath(reversePath, '🟢 ICMP Reply', '#4caf50');
            
            const endTime = Date.now();
            const rtt = endTime - startTime; // Round Trip Time
            
            // 詳細な成功メッセージ
            const detailedResult = [
                `✅ Ping成功`,
                `送信元: ${sourceDevice.name} (${sourceDevice.config.ipAddress})`,
                `送信先: ${targetDevice.name} (${targetDevice.config.ipAddress})`,
                `ネットワーク: ${sourceNetwork} → ${targetNetwork}`,
                `経路: ${routeInfo}`,
                `ホップ数: ${path.length - 1}`,
                `RTT: ${rtt}ms`,
                `通信方式: ${routingType}`
            ].join(' | ');
            
            this.updateStatus(detailedResult);
        } catch (error) {
            this.updateStatus('❌ Ping失敗: パケット送信エラー');
        }
    }
    
    // 経路に沿ったパケットアニメーション（拡張版）
    // アニメーションキューに追加
    addToAnimationQueue(animationFunction) {
        return new Promise((resolve, reject) => {
            const queueItem = {
                execute: animationFunction,
                resolve,
                reject
            };
            
            this.animationQueue.push(queueItem);
            // console.log(`📋 アニメーションキューに追加 (キュー長: ${this.animationQueue.length})`);
            
            // キューが空いていればすぐに実行
            if (!this.isAnimationRunning) {
                this.processAnimationQueue();
            }
        });
    }
    
    // アニメーションキューを処理
    async processAnimationQueue() {
        if (this.isAnimationRunning || this.animationQueue.length === 0) {
            return;
        }
        
        this.isAnimationRunning = true;
        // console.log(`🎬 アニメーションキュー処理開始 (${this.animationQueue.length}件待機中)`);
        
        while (this.animationQueue.length > 0) {
            const queueItem = this.animationQueue.shift();
            
            try {
                // console.log(`▶️ アニメーション実行中... (残り${this.animationQueue.length}件)`);
                const result = await queueItem.execute();
                queueItem.resolve(result);
                // console.log(`✅ アニメーション完了`);
            } catch (error) {
                console.error(`❌ アニメーションエラー:`, error);
                queueItem.reject(error);
            }
        }
        
        this.isAnimationRunning = false;
        // console.log(`🏁 アニメーションキュー処理完了`);
    }
    
    // キューを使ったアニメーション実行（外部からの呼び出し用）
    async queuedAnimatePacketAlongPath(path, label, color, options = {}) {
        return this.addToAnimationQueue(async () => {
            return this.animatePacketAlongPath(path, label, color, options);
        });
    }
    
    async animatePacketAlongPath(path, label, color, options = {}) {
        if (path.length < 2) return;
        
        const {
            hopDelay = 200,      // ホップ間の遅延（ms）
            packetDuration = 1000, // パケットアニメーション時間（ms）
            offsetX = 0,         // X軸オフセット
            offsetY = 0,         // Y軸オフセット
            onHopComplete = null, // ホップ完了コールバック
            onComplete = null     // 全体完了コールバック
        } = options;
        
        // 速度調整を適用
        const speedMultiplier = window.animationSpeedMultiplier || 1.0;
        const adjustedHopDelay = Math.max(10, hopDelay / speedMultiplier);
        const adjustedPacketDuration = Math.max(50, packetDuration / speedMultiplier);
        
        console.log(`📡 経路アニメーション開始: ${label} (${path.length}ホップ)`);
        
        for (let i = 0; i < path.length - 1; i++) {
            console.log(`  ホップ ${i + 1}: ${path[i].name || path[i].id} → ${path[i + 1].name || path[i + 1].id}`);
            
            await this.animatePacket(path[i], path[i + 1], label, color, {
                duration: adjustedPacketDuration,  // 速度調整済み
                offsetX,
                offsetY
            });
            
            // ホップ完了コールバック
            if (onHopComplete) {
                onHopComplete(i, path[i], path[i + 1]);
            }
            
            // 最後以外はホップ間遅延（速度調整済み）
            if (i < path.length - 2 && adjustedHopDelay > 0) {
                await this.sleep(adjustedHopDelay);
            }
        }
        
        console.log(`✅ 経路アニメーション完了: ${label}`);
        
        // 全体完了コールバック
        if (onComplete) {
            onComplete();
        }
    }
    
    // 従来のPingアニメーション（後方互換性のため保持）
    async animatePing(sourceDevice, targetDevice) {
        // ICMPパケット（往復）
        try {
            // Request
            await this.animatePacket(
                sourceDevice, 
                targetDevice, 
                '🔵 ICMP Request', 
                '#2196f3'
            );
            
            await this.sleep(200);
            
            // Reply
            await this.animatePacket(
                targetDevice, 
                sourceDevice, 
                '🟢 ICMP Reply', 
                '#4caf50'
            );
            
            this.updateStatus(`Ping成功: ${sourceDevice.config.ipAddress} ↔ ${targetDevice.config.ipAddress}`);
        } catch (error) {
            this.updateStatus('Ping失敗: 接続エラー');
        }
    }

    // 2つのデバイス間の接続線のパスを取得（drawConnection関数と同じロジック）
    getConnectionPath(fromDevice, toDevice) {
        // デバイス間の接続を検索
        const connection = this.connections.find(conn => 
            (conn.fromDevice === fromDevice.id && conn.toDevice === toDevice.id) ||
            (conn.fromDevice === toDevice.id && conn.toDevice === fromDevice.id)
        );
        
        if (!connection) {
            // 接続が見つからない場合は直線パス
            return {
                startX: fromDevice.x + fromDevice.width / 2,
                startY: fromDevice.y + fromDevice.height / 2,
                endX: toDevice.x + toDevice.width / 2,
                endY: toDevice.y + toDevice.height / 2,
                cp1X: 0, cp1Y: 0, cp2X: 0, cp2Y: 0,
                isBezier: false
            };
        }
        
        // 接続線の描画ロジックと全く同じ処理
        const actualFromDevice = this.devices.get(connection.fromDevice);
        const actualToDevice = this.devices.get(connection.toDevice);
        
        if (!actualFromDevice || !actualToDevice) {
            return {
                startX: fromDevice.x + fromDevice.width / 2,
                startY: fromDevice.y + fromDevice.height / 2,
                endX: toDevice.x + toDevice.width / 2,
                endY: toDevice.y + toDevice.height / 2,
                cp1X: 0, cp1Y: 0, cp2X: 0, cp2Y: 0,
                isBezier: false
            };
        }
        
        // getPortPosition関数を使用してポート位置を取得
        const fromPort = this.getPortPosition(actualFromDevice, connection.fromPort);
        const toPort = this.getPortPosition(actualToDevice, connection.toPort);
        
        if (!fromPort || !toPort) {
            return {
                startX: fromDevice.x + fromDevice.width / 2,
                startY: fromDevice.y + fromDevice.height / 2,
                endX: toDevice.x + toDevice.width / 2,
                endY: toDevice.y + toDevice.height / 2,
                cp1X: 0, cp1Y: 0, cp2X: 0, cp2Y: 0,
                isBezier: false
            };
        }
        
        // drawConnection関数と全く同じ制御点計算
        const controlOffset = 30;
        const cp1x = fromPort.x + controlOffset;
        const cp1y = fromPort.y;
        const cp2x = toPort.x - controlOffset;
        const cp2y = toPort.y;
        
        // パケットの移動方向を決定
        const isForward = (actualFromDevice.id === fromDevice.id);
        
        return isForward ? {
            startX: fromPort.x,
            startY: fromPort.y,
            endX: toPort.x,
            endY: toPort.y,
            cp1X: cp1x, cp1Y: cp1y,
            cp2X: cp2x, cp2Y: cp2y,
            isBezier: true
        } : {
            startX: toPort.x,
            startY: toPort.y,
            endX: fromPort.x,
            endY: fromPort.y,
            cp1X: cp2x, cp1Y: cp2y,
            cp2X: cp1x, cp2Y: cp1y,
            isBezier: true
        };
    }
    
    // デバイスの指定IDのポートを取得
    getPortById(device, portId) {
        if (!device.ports || !device.ports.nics) return null;
        return device.ports.nics.find(port => port.id === portId);
    }
    
    // 3次ベジェ曲線上の点を計算（drawConnection関数と同じ式）
    getPointOnCubicBezierCurve(t, startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY) {
        // drawConnection関数で使われているのと全く同じ3次ベジェ曲線の公式
        const x = Math.pow(1-t, 3) * startX + 
                  3 * Math.pow(1-t, 2) * t * cp1X + 
                  3 * (1-t) * Math.pow(t, 2) * cp2X + 
                  Math.pow(t, 3) * endX;
                  
        const y = Math.pow(1-t, 3) * startY + 
                  3 * Math.pow(1-t, 2) * t * cp1Y + 
                  3 * (1-t) * Math.pow(t, 2) * cp2Y + 
                  Math.pow(t, 3) * endY;
        
        return { x, y };
    }

    // パケットアニメーション（接続線と完全に同じ軌跡）拡張版
    async animatePacket(fromDevice, toDevice, label, color, options = {}) {
        return new Promise((resolve) => {
            const {
                duration = 1000,     // アニメーション時間（ms）
                offsetX = 0,         // X軸オフセット
                offsetY = 0,         // Y軸オフセット
                onComplete = null    // 完了コールバック
            } = options;
            
            const connectionPath = this.getConnectionPath(fromDevice, toDevice);
            
            const packet = {
                x: connectionPath.startX + offsetX,
                y: connectionPath.startY + offsetY,
                label,
                color,
                progress: 0,
                path: connectionPath,
                offsetX,
                offsetY
            };
            
            console.log(`🏃‍♂️ パケットアニメーション: ${fromDevice.name || fromDevice.id} → ${toDevice.name || toDevice.id} (${duration}ms)`);
            
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                packet.progress = Math.min(elapsed / duration, 1);
                
                // イージング関数
                const easeProgress = 1 - Math.pow(1 - packet.progress, 3);
                
                // 接続線のパスに沿って位置を計算
                if (connectionPath.isBezier) {
                    // 3次ベジェ曲線（drawConnection関数と全く同じ軌跡）
                    const point = this.getPointOnCubicBezierCurve(
                        easeProgress,
                        connectionPath.startX, connectionPath.startY,
                        connectionPath.cp1X, connectionPath.cp1Y,
                        connectionPath.cp2X, connectionPath.cp2Y,
                        connectionPath.endX, connectionPath.endY
                    );
                    packet.x = point.x;
                    packet.y = point.y;
                } else {
                    // 直線
                    packet.x = connectionPath.startX + 
                              (connectionPath.endX - connectionPath.startX) * easeProgress;
                    packet.y = connectionPath.startY + 
                              (connectionPath.endY - connectionPath.startY) * easeProgress;
                }
                
                this.renderWithPacket(packet);
                
                if (packet.progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.render(); // パケットを消去
                    
                    // 完了コールバックを実行
                    if (onComplete) {
                        onComplete();
                    }
                    
                    resolve();
                }
            };
            
            animate();
        });
    }

    // パケット付きで描画
    renderWithPacket(packet) {
        this.render();
        
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.scale, this.scale);
        
        // パケット描画
        this.ctx.fillStyle = packet.color;
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(packet.x, packet.y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        
        // パケットラベル
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(packet.label, packet.x, packet.y - 15);
        
        this.ctx.restore();
    }

    // スリープ関数
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // デバイス設定ダイアログ表示
    showDeviceConfig() {
        if (!this.selectedDevice) {
            this.updateStatus('設定するデバイスを選択してください');
            return;
        }
        
        this.currentDeviceConfig = this.selectedDevice;
        
        document.getElementById('dialog-title').textContent = `${this.selectedDevice.name} の設定`;
        document.getElementById('device-name').value = this.selectedDevice.name;
        document.getElementById('ip-address').value = this.selectedDevice.config.ipAddress;
        document.getElementById('subnet-mask').value = this.selectedDevice.config.subnetMask;
        document.getElementById('default-gateway').value = this.selectedDevice.config.defaultGateway;
        
        // DHCPクライアント設定
        document.getElementById('dhcp-enabled').checked = this.selectedDevice.config.dhcpEnabled;
        
        // DHCPサーバー設定（ルーターのみ表示）
        const dhcpServerSection = document.getElementById('dhcp-server-section');
        if (this.selectedDevice.type === 'router') {
            dhcpServerSection.style.display = 'block';
            
            // LAN1 設定
            document.getElementById('lan1-ip').value = this.selectedDevice.config.lan1.ipAddress;
            document.getElementById('lan1-dhcp-enabled').checked = this.selectedDevice.config.lan1.dhcpEnabled;
            document.getElementById('lan1-pool-start').value = this.selectedDevice.config.lan1.dhcpPoolStart;
            document.getElementById('lan1-pool-end').value = this.selectedDevice.config.lan1.dhcpPoolEnd;
            
            // LAN2 設定
            document.getElementById('lan2-ip').value = this.selectedDevice.config.lan2.ipAddress;
            document.getElementById('lan2-dhcp-enabled').checked = this.selectedDevice.config.lan2.dhcpEnabled;
            document.getElementById('lan2-pool-start').value = this.selectedDevice.config.lan2.dhcpPoolStart;
            document.getElementById('lan2-pool-end').value = this.selectedDevice.config.lan2.dhcpPoolEnd;
            
            // LAN3 設定
            document.getElementById('lan3-ip').value = this.selectedDevice.config.lan3.ipAddress;
            document.getElementById('lan3-dhcp-enabled').checked = this.selectedDevice.config.lan3.dhcpEnabled;
            document.getElementById('lan3-pool-start').value = this.selectedDevice.config.lan3.dhcpPoolStart;
            document.getElementById('lan3-pool-end').value = this.selectedDevice.config.lan3.dhcpPoolEnd;
            
            // 共通設定
            document.getElementById('dhcp-lease-time').value = this.selectedDevice.config.dhcpLeaseTime;
        } else {
            dhcpServerSection.style.display = 'none';
        }
        
        // DHCP有効時はIP設定を無効化
        this.toggleIPFields(this.selectedDevice.config.dhcpEnabled);
        
        document.getElementById('dialog-overlay').style.display = 'block';
        document.getElementById('device-config-dialog').style.display = 'block';
        
        // DHCPチェックボックスの変更イベントを設定
        document.getElementById('dhcp-enabled').addEventListener('change', (e) => {
            this.toggleIPFields(e.target.checked);
        });
    }

    // IP設定フィールドの有効/無効切り替え
    toggleIPFields(dhcpEnabled) {
        const fields = ['ip-address', 'subnet-mask', 'default-gateway'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            field.disabled = dhcpEnabled;
            field.style.backgroundColor = dhcpEnabled ? '#f5f5f5' : 'white';
        });
    }

    // デバイス設定ダイアログ非表示
    hideDeviceConfig() {
        document.getElementById('dialog-overlay').style.display = 'none';
        document.getElementById('device-config-dialog').style.display = 'none';
        this.currentDeviceConfig = null;
    }

    // デバイス設定保存
    saveDeviceConfig() {
        if (!this.currentDeviceConfig) return;
        
        const name = document.getElementById('device-name').value;
        const ipAddress = document.getElementById('ip-address').value;
        const subnetMask = document.getElementById('subnet-mask').value;
        const defaultGateway = document.getElementById('default-gateway').value;
        const dhcpEnabled = document.getElementById('dhcp-enabled').checked;
        
        // DHCP無効時のみIP設定を検証
        if (!dhcpEnabled) {
            if (!this.isValidIP(ipAddress)) {
                alert('有効なIPアドレスを入力してください');
                return;
            }
            
            if (!this.isValidIP(subnetMask)) {
                alert('有効なサブネットマスクを入力してください');
                return;
            }
        }
        
        // 基本設定の更新
        this.currentDeviceConfig.name = name;
        this.currentDeviceConfig.config.dhcpEnabled = dhcpEnabled;
        
        if (!dhcpEnabled) {
            // DHCP無効時は手動IP設定を保存
            this.currentDeviceConfig.config.ipAddress = ipAddress;
            this.currentDeviceConfig.config.subnetMask = subnetMask;
            this.currentDeviceConfig.config.defaultGateway = defaultGateway;
        }
        
        // ルーターの場合はDHCPサーバー設定も保存
        if (this.currentDeviceConfig.type === 'router') {
            const dhcpLeaseTime = parseInt(document.getElementById('dhcp-lease-time').value) || 3600;
            
            // LAN1 設定
            const lan1IP = document.getElementById('lan1-ip').value;
            const lan1DHCPEnabled = document.getElementById('lan1-dhcp-enabled').checked;
            const lan1PoolStart = document.getElementById('lan1-pool-start').value;
            const lan1PoolEnd = document.getElementById('lan1-pool-end').value;
            
            if (!this.isValidIP(lan1IP)) {
                alert('有効なLAN1 IPアドレスを入力してください');
                return;
            }
            
            if (lan1DHCPEnabled) {
                if (!this.isValidIP(lan1PoolStart) || !this.isValidIP(lan1PoolEnd)) {
                    alert('有効なLAN1 IPプール範囲を入力してください');
                    return;
                }
            }
            
            // LAN2 設定
            const lan2IP = document.getElementById('lan2-ip').value;
            const lan2DHCPEnabled = document.getElementById('lan2-dhcp-enabled').checked;
            const lan2PoolStart = document.getElementById('lan2-pool-start').value;
            const lan2PoolEnd = document.getElementById('lan2-pool-end').value;
            
            if (!this.isValidIP(lan2IP)) {
                alert('有効なLAN2 IPアドレスを入力してください');
                return;
            }
            
            if (lan2DHCPEnabled) {
                if (!this.isValidIP(lan2PoolStart) || !this.isValidIP(lan2PoolEnd)) {
                    alert('有効なLAN2 IPプール範囲を入力してください');
                    return;
                }
            }
            
            // LAN3 設定
            const lan3IP = document.getElementById('lan3-ip').value;
            const lan3DHCPEnabled = document.getElementById('lan3-dhcp-enabled').checked;
            const lan3PoolStart = document.getElementById('lan3-pool-start').value;
            const lan3PoolEnd = document.getElementById('lan3-pool-end').value;
            
            if (!this.isValidIP(lan3IP)) {
                alert('有効なLAN3 IPアドレスを入力してください');
                return;
            }
            
            if (lan3DHCPEnabled) {
                if (!this.isValidIP(lan3PoolStart) || !this.isValidIP(lan3PoolEnd)) {
                    alert('有効なLAN3 IPプール範囲を入力してください');
                    return;
                }
            }
            
            // 設定を保存
            this.currentDeviceConfig.config.lan1.ipAddress = lan1IP;
            this.currentDeviceConfig.config.lan1.dhcpEnabled = lan1DHCPEnabled;
            this.currentDeviceConfig.config.lan1.dhcpPoolStart = lan1PoolStart;
            this.currentDeviceConfig.config.lan1.dhcpPoolEnd = lan1PoolEnd;
            
            this.currentDeviceConfig.config.lan2.ipAddress = lan2IP;
            this.currentDeviceConfig.config.lan2.dhcpEnabled = lan2DHCPEnabled;
            this.currentDeviceConfig.config.lan2.dhcpPoolStart = lan2PoolStart;
            this.currentDeviceConfig.config.lan2.dhcpPoolEnd = lan2PoolEnd;
            
            this.currentDeviceConfig.config.lan3.ipAddress = lan3IP;
            this.currentDeviceConfig.config.lan3.dhcpEnabled = lan3DHCPEnabled;
            this.currentDeviceConfig.config.lan3.dhcpPoolStart = lan3PoolStart;
            this.currentDeviceConfig.config.lan3.dhcpPoolEnd = lan3PoolEnd;
            
            this.currentDeviceConfig.config.dhcpLeaseTime = dhcpLeaseTime;
            
            // 後方互換性のために旧設定も同期
            this.currentDeviceConfig.config.dhcpServerEnabled = lan1DHCPEnabled;
            this.currentDeviceConfig.config.dhcpPoolStart = lan1PoolStart;
            this.currentDeviceConfig.config.dhcpPoolEnd = lan1PoolEnd;
            this.currentDeviceConfig.config.ipAddress = lan1IP; // メインIPはLAN1に設定
            
            // DHCP設定変更時のクライアント再配布
            this.redistributeDHCPAddresses(this.currentDeviceConfig);
        }
        
        // DHCP有効デバイスのIPアドレス取得を試行
        if (dhcpEnabled) {
            // 前の静的IPアドレスをクリア
            this.currentDeviceConfig.config.ipAddress = '0.0.0.0';
            
            // DHCP要求を実行
            const success = this.requestDHCPAddress(this.currentDeviceConfig);
            
            if (!success) {
                console.log(`DHCP要求失敗: ${this.currentDeviceConfig.name}`);
                // DHCPが失敗した場合、一時的に無効なIPを設定
                this.currentDeviceConfig.config.ipAddress = '0.0.0.0';
            }
        }
        
        this.hideDeviceConfig();
        this.updateStatus(`${name} の設定を更新しました`);
        this.scheduleRender();
    }

    // IPアドレス検証
    isValidIP(ip) {
        const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ip.match(regex);
        if (!match) return false;
        
        for (let i = 1; i <= 4; i++) {
            const num = parseInt(match[i]);
            if (num < 0 || num > 255) return false;
        }
        return true;
    }

    // コントロールボタン更新
    updateControlButtons() {
        const hasDevices = this.devices.size > 0;
        const hasSelectedDevice = this.selectedDevice !== null;
        const hasPingableDevices = this.devices.size >= 2;
        
        const pingBtn = document.getElementById('ping-btn');
        pingBtn.disabled = !hasPingableDevices;
        
        // Pingボタンのテキストを動的に変更
        if (this.isPingMode) {
            pingBtn.textContent = '⏹️ Ping終了';
            pingBtn.style.backgroundColor = '#f44336';
        } else {
            pingBtn.textContent = '🚀 Ping';
            pingBtn.style.backgroundColor = '#2196f3';
        }
        
        // HTTPボタンの制御
        const httpBtn = document.getElementById('http-btn');
        if (httpBtn) {
            httpBtn.disabled = !hasPingableDevices || this.isPingMode;
            
            // HTTPボタンのテキストを動的に変更
            if (this.isHTTPMode) {
                httpBtn.textContent = '⏹️ HTTP終了';
                httpBtn.style.backgroundColor = '#f44336';
            } else {
                httpBtn.textContent = '🌐 HTTP';
                httpBtn.style.backgroundColor = '#2196f3';
            }
        }
        
        document.getElementById('config-btn').disabled = !hasSelectedDevice || this.isPingMode || this.isHTTPMode;
    }

    // ステータス更新
    updateStatus(message) {
        document.getElementById('status-text').textContent = message || 'デバイスを配置してください';
    }

    // 描画
    render() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.scale, this.scale);
        
        // レンダリング前に、接続されている単一NICデバイスの位置を更新
        for (const device of this.devices.values()) {
            if (this.isSingleNICDevice(device)) {
                this.updateDynamicNICPosition(device);
            }
        }
        
        // 接続線を描画
        this.drawConnections();
        
        // デバイスを描画
        this.drawDevices();
        
        // ペンディングデバイスを描画
        if (this.pendingDevice) {
            this.drawDevice(this.pendingDevice);
        }
        
        // 接続開始時の一時的な線
        if (this.connectionStart) {
            this.drawTemporaryConnection();
        }
        
        this.ctx.restore();
        
        // パレットエリアのハイライト（デバイスドラッグ中）
        if (this.isDragging && this.selectedDevice && !this.pendingDevice) {
            this.drawPaletteDropZone();
        }
    }
    
    // パレットドロップゾーンのハイライト描画
    drawPaletteDropZone() {
        const paletteRect = this.getPaletteRect();
        if (!paletteRect) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // パレットエリアをキャンバス座標系に変換
        const x = paletteRect.left - canvasRect.left;
        const y = paletteRect.top - canvasRect.top;
        const width = paletteRect.width;
        const height = paletteRect.height;
        
        // 半透明の赤色でハイライト
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 99, 71, 0.3)';
        this.ctx.fillRect(x, y, width, height);
        
        // 境界線を描画
        this.ctx.strokeStyle = '#ff6347';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
        
        // 削除アイコンまたはテキストを表示
        this.ctx.fillStyle = '#ff6347';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🗑️ ここにドロップで削除', x + width/2, y + height/2);
        
        this.ctx.restore();
    }

    // 接続線描画
    drawConnections() {
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        
        for (const connection of this.connections) {
            this.drawConnection(connection);
        }
    }

    // 個別接続線の描画
    drawConnection(connection) {
        let fromDevice, toDevice, fromPortId, toPortId;
        
        // 新しい形式（from/to オブジェクト）と古い形式の両方をサポート
        if (connection.from && connection.to) {
            // 新しい形式
            fromDevice = connection.from.device;
            toDevice = connection.to.device;
            fromPortId = connection.from.port.id;
            toPortId = connection.to.port.id;
        } else {
            // 古い形式（後方互換性）
            fromDevice = this.devices.get(connection.fromDevice);
            toDevice = this.devices.get(connection.toDevice);
            fromPortId = connection.fromPort;
            toPortId = connection.toPort;
        }
        
        if (!fromDevice || !toDevice) return;
        
        // 接続元と接続先の端子位置を取得
        const fromPort = this.getPortPosition(fromDevice, fromPortId);
        const toPort = this.getPortPosition(toDevice, toPortId);
        
        if (!fromPort || !toPort) return;
        
        // 接続線のスタイル
        this.ctx.strokeStyle = connection.selected ? '#ff9800' : '#333';
        this.ctx.lineWidth = connection.selected ? 3 : 2;
        
        // ベジェ曲線で接続線を描画
        this.ctx.beginPath();
        this.ctx.moveTo(fromPort.x, fromPort.y);
        
        // 制御点の計算（水平方向に少し離れた位置）
        const controlOffset = 30;
        const cp1x = fromPort.x + controlOffset;
        const cp1y = fromPort.y;
        const cp2x = toPort.x - controlOffset;
        const cp2y = toPort.y;
        
        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toPort.x, toPort.y);
        this.ctx.stroke();
        
        // 接続線の中点に信号の流れを示すマーカー
        if (connection.showFlow) {
            const t = 0.5; // 中点
            const markerX = Math.pow(1-t, 3) * fromPort.x + 3 * Math.pow(1-t, 2) * t * cp1x + 3 * (1-t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * toPort.x;
            const markerY = Math.pow(1-t, 3) * fromPort.y + 3 * Math.pow(1-t, 2) * t * cp1y + 3 * (1-t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * toPort.y;
            
            this.ctx.fillStyle = '#4caf50';
            this.ctx.beginPath();
            this.ctx.arc(markerX, markerY, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    // デバイスの指定NICポートの位置を取得
    getPortPosition(device, portId) {
        const ports = device.ports;
        if (!ports || !ports.nics) return null;
        
        // NICポートから検索
        for (const port of ports.nics) {
            if (port.id === portId) {
                return {
                    x: device.x + port.x * device.width,
                    y: device.y + port.y * device.height
                };
            }
        }
        
        return null;
    }

    // 一時的な接続線描画
    drawTemporaryConnection() {
        if (!this.connectionStart) return;
        
        const device = this.connectionStart.device;
        const port = this.connectionStart.port;
        
        const startX = device.x + port.x * device.width;
        const startY = device.y + port.y * device.height;
        
        // currentMousePosは既にワールド座標系なのでそのまま使用
        const endX = this.currentMousePos.x;
        const endY = this.currentMousePos.y;
        
        this.ctx.strokeStyle = '#ff9800';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // 開始ポートをハイライト
        this.ctx.strokeStyle = '#ff9800';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(startX, startY, 6, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    // デバイス描画
    drawDevices() {
        // Z-indexでソート
        const sortedDevices = Array.from(this.devices.values())
            .sort((a, b) => a.zIndex - b.zIndex);
        
        for (const device of sortedDevices) {
            this.drawDevice(device);
        }
    }

    // 個別デバイス描画（HTTPハイライト対応版）
    drawDevice(device, httpHighlight = null) {
        const isSelected = this.selectedDevice && this.selectedDevice.id === device.id;
        const isConnectionStart = this.connectionStart && this.connectionStart.device && this.connectionStart.device.id === device.id;
        
        // Pingモードでのハイライト判定
        let pingHighlight = null;
        if (this.isPingMode) {
            if (device === this.pingSourceDevice) {
                pingHighlight = 'source';
            } else if (device === this.pingTargetDevice) {
                pingHighlight = 'target';
            }
        }
        
        // HTTP モードでのハイライト（引数で渡される）
        if (httpHighlight) {
            pingHighlight = httpHighlight; // 同じ描画ロジックを使用
        }
        
        // エラー点滅効果
        const errorBlink = this.errorBlinkDevices && this.errorBlinkDevices.has(device);
        const blinkPhase = Math.floor(Date.now() / 200) % 2; // 200msごとに点滅
        
        // デバイス背景色
        if (errorBlink && blinkPhase === 0) {
            this.ctx.fillStyle = '#ffebee'; // エラー時の点滅色（薄い赤）
        } else if (pingHighlight === 'source' || httpHighlight === 'source') {
            this.ctx.fillStyle = '#e3f2fd'; // 送信元は青系
        } else if (pingHighlight === 'target' || httpHighlight === 'target') {
            this.ctx.fillStyle = '#ffebee'; // 送信先は赤系
        } else {
            this.ctx.fillStyle = this.getDeviceColor(device.type);
        }
        
        // デバイス枠線
        if (errorBlink && blinkPhase === 0) {
            this.ctx.strokeStyle = '#f44336'; // エラー時の枠線（赤）
            this.ctx.lineWidth = 3;
        } else if (pingHighlight === 'source' || httpHighlight === 'source') {
            this.ctx.strokeStyle = '#2196f3'; // 送信元は青
            this.ctx.lineWidth = 4;
        } else if (pingHighlight === 'target' || httpHighlight === 'target') {
            this.ctx.strokeStyle = '#f44336'; // 送信先は赤
            this.ctx.lineWidth = 4;
        } else {
            this.ctx.strokeStyle = isSelected ? '#2196f3' : (isConnectionStart ? '#ff9800' : '#666');
            this.ctx.lineWidth = isSelected || isConnectionStart ? 3 : 1;
        }
        
        this.ctx.fillRect(device.x, device.y, device.width, device.height);
        this.ctx.strokeRect(device.x, device.y, device.width, device.height);
        
        // 端子を描画
        this.drawDevicePorts(device);
        
        // アイコン
        this.ctx.font = '20px Arial';
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            this.getDeviceIcon(device.type),
            device.x + device.width / 2,
            device.y + 25
        );
        
        // デバイス名
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#333';
        let displayName = device.name;
        
        // モードでのインジケーター追加
        if (pingHighlight === 'source') {
            displayName = '🔵 ' + device.name + ' (送信元)';
            this.ctx.fillStyle = '#2196f3';
        } else if (pingHighlight === 'target') {
            displayName = '🔴 ' + device.name + ' (送信先)';
            this.ctx.fillStyle = '#f44336';
        } else if (httpHighlight === 'source') {
            displayName = '🌐 ' + device.name + ' (クライアント)';
            this.ctx.fillStyle = '#2196f3';
        } else if (httpHighlight === 'target') {
            displayName = '🖥️ ' + device.name + ' (サーバー)';
            this.ctx.fillStyle = '#f44336';
        }
        
        this.ctx.fillText(
            displayName,
            device.x + device.width / 2,
            device.y + device.height - 18
        );
        
        // IPアドレス表示（常時表示）
        this.ctx.font = '9px Arial';
        this.ctx.fillStyle = '#666';
        const cidr = this.subnetMaskToCIDR(device.config.subnetMask);
        this.ctx.fillText(
            `${device.config.ipAddress}/${cidr}`,
            device.x + device.width / 2,
            device.y + device.height - 6
        );
    }

    // デバイスのNICポートを描画
    drawDevicePorts(device) {
        const ports = device.ports;
        if (!ports || !ports.nics) return;
        
        // NICポート
        ports.nics.forEach(port => {
            this.drawPort(device, port, 'nic');
        });
    }

    // 個別NICポートの描画
    drawPort(device, port, type) {
        const x = device.x + port.x * device.width;
        const y = device.y + port.y * device.height;
        const radius = 4;
        
        // ホバー効果（接続開始時やマウス近接時）
        let isHovered = false;
        if (this.currentMousePos) {
            const distance = Math.sqrt((this.currentMousePos.x - x) ** 2 + (this.currentMousePos.y - y) ** 2);
            isHovered = distance <= 8;
        }
        
        // 接続状態をチェック
        const isConnected = this.connections.some(conn =>
            (conn.fromDevice === device.id && conn.fromPort === port.id) ||
            (conn.toDevice === device.id && conn.toPort === port.id)
        );
        
        // NICポートの背景色（統一デザイン）
        if (isHovered) {
            this.ctx.fillStyle = '#ff9800'; // ホバー時はオレンジ
        } else if (isConnected) {
            this.ctx.fillStyle = '#4caf50'; // 接続済みは緑
        } else {
            this.ctx.fillStyle = '#2196f3'; // 未接続は青
        }
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 端子の枠線
        this.ctx.strokeStyle = isHovered ? '#ff5722' : '#333';
        this.ctx.lineWidth = isHovered ? 2 : 1;
        this.ctx.stroke();
        
        // 端子のラベル
        if (port.label) {
            this.ctx.font = '8px Arial';
            this.ctx.fillStyle = isHovered ? '#ff5722' : '#333';
            // ラベル位置を動的に調整（左右の端子に応じて）
            this.ctx.textAlign = port.x < 0.5 ? 'right' : 'left';
            const labelX = x + (port.x < 0.5 ? -8 : 8);
            this.ctx.fillText(port.label, labelX, y + 2);
        }
    }

    // デバイス色取得
    getDeviceColor(type) {
        const colors = {
            'pc': '#e3f2fd',
            'router': '#f3e5f5',
            'switch': '#e8f5e8',
            'server': '#fff3e0',
            'hub': '#fce4ec'
        };
        return colors[type] || '#f5f5f5';
    }

    // デバイスアイコン取得
    getDeviceIcon(type) {
        const icons = {
            'pc': '💻',
            'router': '📡',
            'switch': '🔌',
            'server': '🖥️',
            'hub': '⚡'
        };
        return icons[type] || '📱';
    }

    // DHCP アドレス要求（複数LAN対応・デバッグ強化）
    requestDHCPAddress(client) {
        console.log(`\n=== DHCP要求開始: ${client.name} ===`);
        
        // 接続されたDHCPサーバー（ルーター）を探す
        const dhcpServerInfo = this.findDHCPServer(client);
        
        if (!dhcpServerInfo) {
            const message = `❌ DHCP失敗: ${client.name} - DHCPサーバーが見つかりません`;
            console.log(message);
            this.updateStatus(message);
            client.config.ipAddress = '0.0.0.0';
            return false;
        }
        
        const { router, lanConfig } = dhcpServerInfo;
        const lanName = this.getLANName(router, lanConfig);
        
        console.log(`DHCP: ${client.name} -> ${router.name} (${lanName})`);
        console.log(`プール範囲: ${lanConfig.dhcpPoolStart} - ${lanConfig.dhcpPoolEnd}`);
        
        // DHCPプールから利用可能なIPアドレスを割り当て
        const assignedIP = this.allocateDHCPAddressFromLAN(lanConfig, client, router);
        
        if (!assignedIP) {
            const message = `❌ DHCP失敗: ${client.name} - 利用可能なIPアドレスがありません (${lanName})`;
            console.log(message);
            this.updateStatus(message);
            client.config.ipAddress = '0.0.0.0';
            return false;
        }
        
        // クライアントにIPアドレスを設定
        client.config.ipAddress = assignedIP.ip;
        client.config.subnetMask = '255.255.255.0'; // 固定サブネットマスク
        client.config.defaultGateway = lanConfig.ipAddress; // そのLANのゲートウェイ
        
        const message = `✅ DHCP成功: ${client.name} に ${assignedIP.ip} を割り当てました (${lanName})`;
        console.log(message);
        console.log(`=== DHCP要求完了: ${client.name} ===\n`);
        
        this.updateStatus(message);
        this.scheduleRender(); // 画面更新をスケジュール
        return true;
    }

    // DHCPサーバーを探す（複数LAN対応）
    findDHCPServer(client) {
        // 物理的に接続されたデバイスをBFSで探索
        const visited = new Set();
        const queue = [client.id];
        visited.add(client.id);
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentDevice = this.devices.get(currentId);
            
            if (!currentDevice) continue;
            
            // 現在のデバイスがDHCPサーバー有効なルーターかチェック
            if (currentDevice.type === 'router' && currentDevice !== client) {
                // いずれかのLANでDHCPが有効になっているかチェック
                if (currentDevice.config.lan1?.dhcpEnabled || 
                    currentDevice.config.lan2?.dhcpEnabled || 
                    currentDevice.config.lan3?.dhcpEnabled) {
                    
                    // クライアントがどのLANに接続されているか判定
                    const lanConfig = this.determineLANConnection(client, currentDevice);
                    if (lanConfig) {
                        return { router: currentDevice, lanConfig: lanConfig };
                    }
                }
            }
            
            // 隣接デバイスをキューに追加
            for (const connection of this.connections) {
                let nextDeviceId = null;
                
                if (connection.fromDevice === currentId && !visited.has(connection.toDevice)) {
                    nextDeviceId = connection.toDevice;
                } else if (connection.toDevice === currentId && !visited.has(connection.fromDevice)) {
                    nextDeviceId = connection.fromDevice;
                }
                
                if (nextDeviceId) {
                    visited.add(nextDeviceId);
                    queue.push(nextDeviceId);
                }
            }
        }
        
        return null;
    }

    // クライアントが接続されているLANを判定（スイッチ経由対応）
    determineLANConnection(client, router) {
        // ルーターへの経路を取得してLANを判定
        const pathToRouter = this.findPath(client, router);
        
        if (pathToRouter && pathToRouter.length > 1) {
            // ルーターに直接接続されている最後のデバイス（ルーターの隣接デバイス）を特定
            const routerNeighbor = pathToRouter[pathToRouter.length - 2];
            const routerConnection = this.findDirectConnection(routerNeighbor, router);
            
            if (routerConnection) {
                // ルーターのポート番号に基づいてLANを判定
                const routerPortIndex = this.getPortIndex(router, routerConnection, router.id === routerConnection.fromDevice);
                
                // ポート0-1: LAN1, ポート2-3: LAN2, ポート4-5: LAN3 として判定
                if (routerPortIndex <= 1 && router.config.lan1?.dhcpEnabled) {
                    return router.config.lan1;
                } else if (routerPortIndex <= 3 && router.config.lan2?.dhcpEnabled) {
                    return router.config.lan2;
                } else if (routerPortIndex <= 5 && router.config.lan3?.dhcpEnabled) {
                    return router.config.lan3;
                }
            }
        }
        
        // フォールバック1: スイッチ経由の場合、スイッチの位置で判定
        const switchInPath = this.findSwitchInPath(pathToRouter);
        if (switchInPath) {
            const switchX = switchInPath.x;
            const routerX = router.x;
            const distance = Math.abs(switchX - routerX);
            
            // スイッチとルーター間の距離でLANを判定
            if (distance < 100 && router.config.lan1?.dhcpEnabled) {
                return router.config.lan1;
            } else if (distance < 200 && router.config.lan2?.dhcpEnabled) {
                return router.config.lan2;
            } else if (router.config.lan3?.dhcpEnabled) {
                return router.config.lan3;
            }
        }
        
        // フォールバック2: クライアントの位置に基づく判定
        const clientX = client.x;
        const routerX = router.x;
        const distance = Math.abs(clientX - routerX);
        
        // 距離に基づいてLANを推測（近い順に割り当て）
        if (distance < 150 && router.config.lan1?.dhcpEnabled) {
            return router.config.lan1;
        } else if (distance < 300 && router.config.lan2?.dhcpEnabled) {
            return router.config.lan2;
        } else if (router.config.lan3?.dhcpEnabled) {
            return router.config.lan3;
        }
        
        // 最後のフォールバック: 有効なLANから順に割り当て
        if (router.config.lan1?.dhcpEnabled) {
            return router.config.lan1;
        }
        if (router.config.lan2?.dhcpEnabled) {
            return router.config.lan2;
        }
        if (router.config.lan3?.dhcpEnabled) {
            return router.config.lan3;
        }
        
        return null;
    }

    // 経路内のスイッチを検索
    findSwitchInPath(path) {
        if (!path) return null;
        
        return path.find(device => device.type === 'switch' || device.type === 'hub');
    }

    // 2つのデバイス間の直接接続を探す
    findDirectConnection(device1, device2) {
        return this.connections.find(conn => 
            (conn.fromDevice === device1.id && conn.toDevice === device2.id) ||
            (conn.fromDevice === device2.id && conn.toDevice === device1.id)
        );
    }

    // 接続におけるデバイスのポート番号を取得
    getPortIndex(device, connection, isFromDevice) {
        const portId = isFromDevice ? connection.fromPort : connection.toPort;
        const ports = device.ports?.nics || [];
        
        return ports.findIndex(port => port.id === portId);
    }

    // 指定LANからDHCPアドレス割り当て（競合状態対応）
    allocateDHCPAddressFromLAN(lanConfig, client, router) {
        const poolStart = this.ipToInt(lanConfig.dhcpPoolStart);
        const poolEnd = this.ipToInt(lanConfig.dhcpPoolEnd);
        const leaseTime = router.config.dhcpLeaseTime;
        const now = Date.now();
        
        // 既存の割り当てを確認・クリーンアップ
        this.cleanupExpiredLeasesFromLAN(lanConfig, now);
        
        // クライアントが既にIPアドレスを持っているかチェック
        for (const [ip, lease] of lanConfig.dhcpAllocatedIPs.entries()) {
            if (lease.clientId === client.id && lease.expiry > now) {
                // IPアドレスが現在のプール範囲内にある場合のみリース更新
                if (ip >= poolStart && ip <= poolEnd) {
                    lease.expiry = now + (leaseTime * 1000);
                    console.log(`DHCP: リース更新 ${client.name} -> ${this.intToIp(ip)} (範囲内)`);
                    return { ip: this.intToIp(ip), lease: lease };
                } else {
                    // プール範囲外の場合は古いリースを削除
                    console.log(`DHCP: 範囲外リース削除 ${client.name} -> ${this.intToIp(ip)}`);
                    lanConfig.dhcpAllocatedIPs.delete(ip);
                }
            }
        }
        
        // 全ての既存のデバイスのIPアドレスをチェックして重複を避ける
        const existingIPs = new Set();
        
        // 現在のLANで割り当て済みのIPを収集
        for (const [ip] of lanConfig.dhcpAllocatedIPs.entries()) {
            existingIPs.add(ip);
        }
        
        // 他のデバイスの静的IPも収集（同じプール範囲内）
        for (const [, device] of this.devices.entries()) {
            if (device !== client && device.config.ipAddress && device.config.ipAddress !== '0.0.0.0') {
                const deviceIP = this.ipToInt(device.config.ipAddress);
                if (deviceIP >= poolStart && deviceIP <= poolEnd) {
                    existingIPs.add(deviceIP);
                    console.log(`DHCP: 既存IP検出 ${device.name} -> ${device.config.ipAddress}`);
                }
            }
        }
        
        // 新しいIPアドレスを探す（重複チェック強化）
        for (let ipInt = poolStart; ipInt <= poolEnd; ipInt++) {
            if (!existingIPs.has(ipInt) && !this.isIPAddressInUse(this.intToIp(ipInt))) {
                const lease = {
                    clientId: client.id,
                    clientName: client.name,
                    expiry: now + (leaseTime * 1000),
                    assignedAt: now,
                    lanName: this.getLANName(router, lanConfig)
                };
                
                lanConfig.dhcpAllocatedIPs.set(ipInt, lease);
                console.log(`DHCP: 新規割り当て ${client.name} -> ${this.intToIp(ipInt)} (${lease.lanName})`);
                return { ip: this.intToIp(ipInt), lease: lease };
            }
        }
        
        console.log(`DHCP: プール満杯 - ${client.name} への割り当て失敗`);
        return null; // プールが満杯
    }

    // IPアドレスが他のデバイスで使用中かチェック
    isIPAddressInUse(ipAddress) {
        for (const [, device] of this.devices.entries()) {
            if (device.config.ipAddress === ipAddress) {
                return true;
            }
        }
        return false;
    }

    // LAN名取得
    getLANName(router, lanConfig) {
        if (lanConfig === router.config.lan1) return 'LAN1';
        if (lanConfig === router.config.lan2) return 'LAN2';
        if (lanConfig === router.config.lan3) return 'LAN3';
        return 'Unknown LAN';
    }

    // 指定LANの期限切れリースのクリーンアップ（範囲外リースも削除）
    cleanupExpiredLeasesFromLAN(lanConfig, currentTime) {
        const toDelete = [];
        const poolStart = this.ipToInt(lanConfig.dhcpPoolStart);
        const poolEnd = this.ipToInt(lanConfig.dhcpPoolEnd);
        
        for (const [ip, lease] of lanConfig.dhcpAllocatedIPs.entries()) {
            // 期限切れまたはプール範囲外のリースを削除対象に追加
            if (lease.expiry <= currentTime) {
                console.log(`DHCP: 期限切れリース削除 ${lease.clientName} -> ${this.intToIp(ip)}`);
                toDelete.push(ip);
            } else if (ip < poolStart || ip > poolEnd) {
                console.log(`DHCP: 範囲外リース削除 ${lease.clientName} -> ${this.intToIp(ip)}`);
                toDelete.push(ip);
            }
        }
        
        for (const ip of toDelete) {
            lanConfig.dhcpAllocatedIPs.delete(ip);
        }
    }

    // DHCPアドレス割り当て（後方互換性）
    allocateDHCPAddress(dhcpServer, client) {
        // 旧バージョン互換性のため、LAN1から割り当て
        return this.allocateDHCPAddressFromLAN(dhcpServer.config.lan1 || dhcpServer.config, client, dhcpServer);
    }

    // 期限切れリースのクリーンアップ
    cleanupExpiredLeases(dhcpServer, currentTime) {
        const expired = [];
        
        for (const [ip, lease] of dhcpServer.config.dhcpAllocatedIPs.entries()) {
            if (lease.expiry <= currentTime) {
                expired.push(ip);
            }
        }
        
        for (const ip of expired) {
            dhcpServer.config.dhcpAllocatedIPs.delete(ip);
        }
    }

    // DHCP リース情報表示（複数LAN対応・デバッグ用）
    showDHCPLeases(router) {
        if (!router || router.type !== 'router') {
            console.log('ルーターではありません');
            return;
        }
        
        console.log(`\n=== ${router.name} の DHCP リース情報 ===`);
        console.log(`リース時間: ${router.config.dhcpLeaseTime}秒`);
        
        const now = Date.now();
        let totalLeases = 0;
        
        // LAN1 リース表示
        if (router.config.lan1?.dhcpEnabled) {
            console.log(`\nLAN1 (${router.config.lan1.ipAddress}):`);
            console.log(`  プール: ${router.config.lan1.dhcpPoolStart} - ${router.config.lan1.dhcpPoolEnd}`);
            const lan1Leases = router.config.lan1.dhcpAllocatedIPs.size;
            console.log(`  割り当て済み: ${lan1Leases}個`);
            
            for (const [ipInt, lease] of router.config.lan1.dhcpAllocatedIPs.entries()) {
                const ip = this.intToIp(ipInt);
                const remaining = Math.max(0, Math.floor((lease.expiry - now) / 1000));
                console.log(`    ${ip} -> ${lease.clientName} (残り${remaining}秒)`);
                totalLeases++;
            }
        }
        
        // LAN2 リース表示
        if (router.config.lan2?.dhcpEnabled) {
            console.log(`\nLAN2 (${router.config.lan2.ipAddress}):`);
            console.log(`  プール: ${router.config.lan2.dhcpPoolStart} - ${router.config.lan2.dhcpPoolEnd}`);
            const lan2Leases = router.config.lan2.dhcpAllocatedIPs.size;
            console.log(`  割り当て済み: ${lan2Leases}個`);
            
            for (const [ipInt, lease] of router.config.lan2.dhcpAllocatedIPs.entries()) {
                const ip = this.intToIp(ipInt);
                const remaining = Math.max(0, Math.floor((lease.expiry - now) / 1000));
                console.log(`    ${ip} -> ${lease.clientName} (残り${remaining}秒)`);
                totalLeases++;
            }
        }
        
        // LAN3 リース表示
        if (router.config.lan3?.dhcpEnabled) {
            console.log(`\nLAN3 (${router.config.lan3.ipAddress}):`);
            console.log(`  プール: ${router.config.lan3.dhcpPoolStart} - ${router.config.lan3.dhcpPoolEnd}`);
            const lan3Leases = router.config.lan3.dhcpAllocatedIPs.size;
            console.log(`  割り当て済み: ${lan3Leases}個`);
            
            for (const [ipInt, lease] of router.config.lan3.dhcpAllocatedIPs.entries()) {
                const ip = this.intToIp(ipInt);
                const remaining = Math.max(0, Math.floor((lease.expiry - now) / 1000));
                console.log(`    ${ip} -> ${lease.clientName} (残り${remaining}秒)`);
                totalLeases++;
            }
        }
        
        console.log(`\n総割り当て数: ${totalLeases}個`);
        console.log(`=== DHCP リース情報終了 ===\n`);
    }

    // 全ルーターのDHCP状況を表示
    showAllDHCPLeases() {
        console.log('\n=== 全ルーターのDHCP状況 ===');
        
        let routerCount = 0;
        for (const [, device] of this.devices.entries()) {
            if (device.type === 'router') {
                this.showDHCPLeases(device);
                routerCount++;
            }
        }
        
        if (routerCount === 0) {
            console.log('DHCPサーバーが見つかりません');
        }
        
        console.log('=== 全ルーター情報終了 ===\n');
    }

    // DHCP設定変更時のクライアント再配布
    redistributeDHCPAddresses(router) {
        console.log(`\n=== DHCP再配布開始: ${router.name} ===`);
        
        if (router.type !== 'router') {
            console.log('ルーターではないため、再配布をスキップ');
            return;
        }
        
        const affectedClients = [];
        
        // このルーターのDHCPを利用している全クライアントを検出
        for (const [, device] of this.devices.entries()) {
            if (device !== router && device.config.dhcpEnabled) {
                // このデバイスがこのルーターからDHCPを受けているかチェック
                const dhcpServerInfo = this.findDHCPServer(device);
                if (dhcpServerInfo && dhcpServerInfo.router === router) {
                    affectedClients.push({
                        client: device,
                        lanConfig: dhcpServerInfo.lanConfig
                    });
                }
            }
        }
        
        console.log(`影響を受けるクライアント数: ${affectedClients.length}`);
        
        if (affectedClients.length === 0) {
            console.log('再配布対象のクライアントがありません');
            console.log('=== DHCP再配布終了 ===\n');
            return;
        }
        
        // 各クライアントに新しいIPアドレスを割り当て
        let redistributedCount = 0;
        
        for (const { client, lanConfig } of affectedClients) {
            const oldIP = client.config.ipAddress;
            
            // 現在のリースを削除（新しい範囲で再割り当てするため）
            this.clearClientLease(client, lanConfig);
            
            // 新しいIPアドレスを要求
            const success = this.requestDHCPAddress(client);
            
            if (success) {
                redistributedCount++;
                console.log(`再配布成功: ${client.name} ${oldIP} -> ${client.config.ipAddress}`);
                
                // ステータスメッセージを更新
                this.updateStatus(`🔄 DHCP再配布: ${client.name} ${oldIP} -> ${client.config.ipAddress}`);
            } else {
                console.log(`再配布失敗: ${client.name} (${oldIP})`);
            }
        }
        
        console.log(`再配布完了: ${redistributedCount}/${affectedClients.length} 成功`);
        console.log('=== DHCP再配布終了 ===\n');
        
        // 画面更新
        this.scheduleRender();
    }

    // クライアントの現在のリースを削除
    clearClientLease(client, lanConfig) {
        const toDelete = [];
        
        // 該当クライアントのリースを全て検索して削除
        for (const [ip, lease] of lanConfig.dhcpAllocatedIPs.entries()) {
            if (lease.clientId === client.id) {
                toDelete.push(ip);
            }
        }
        
        for (const ip of toDelete) {
            lanConfig.dhcpAllocatedIPs.delete(ip);
            console.log(`リース削除: ${client.name} -> ${this.intToIp(ip)}`);
        }
        
        // IPアドレスをクリア
        client.config.ipAddress = '0.0.0.0';
    }

    // デバイスクリック処理（シングル・ダブルクリック対応）
    handleDeviceClick(device) {
        const currentTime = performance.now();
        const timeDiff = currentTime - this.lastClickTime;
        
        // ダブルクリック・ダブルタップの判定
        if (this.lastClickedDevice === device && timeDiff < this.doubleClickDelay) {
            console.log('ダブルクリック検出:', device.name);
            this.handleDoubleClick(device);
        } else {
            console.log('シングルクリック検出:', device.name);
            this.handleSingleClick(device);
        }
        
        // 状態を更新
        this.lastClickTime = currentTime;
        this.lastClickedDevice = device;
    }

    // シングルクリック処理
    handleSingleClick(device) {
        // デバイスの選択状態は維持する（設定ボタンが有効になる）
        const deviceType = this.isTouchDevice() ? 'タップ' : 'クリック';
        this.updateStatus(`${device.name}を選択しました（ダブル${deviceType}で設定画面を開きます）`);
        this.scheduleRender();
    }

    // ダブルクリック処理
    handleDoubleClick(device) {
        const actionType = this.isTouchDevice() ? 'ダブルタップ' : 'ダブルクリック';
        console.log(`${actionType}で設定画面を開く:`, device.name);
        
        // 設定画面を自動で開く
        this.showDeviceConfig();
        
        this.updateStatus(`${device.name}の設定画面を開きました`);
    }

    // ネットワーク構成を保存
    saveNetwork() {
        // デバイスデータの作成
        const devicesData = Array.from(this.devices.values()).map(device => ({
            id: device.id,
            type: device.type,
            name: device.name,
            x: device.x,
            y: device.y,
            width: device.width,
            height: device.height,
            config: {
                ipAddress: device.config.ipAddress,
                subnetMask: device.config.subnetMask,
                gateway: device.config.gateway,
                dhcp: device.config.dhcp || {}
            },
            ports: {
                nics: device.ports.nics.map(port => ({
                    id: port.id,
                    x: port.x,
                    y: port.y,
                    side: port.side,
                    connected: port.connected
                }))
            }
        }));

        // 接続データの作成
        const connectionsData = this.connections.map(connection => ({
            id: connection.id,
            from: {
                deviceId: connection.from.device.id,
                portId: connection.from.port.id
            },
            to: {
                deviceId: connection.to.device.id,
                portId: connection.to.port.id
            }
        }));

        // 保存データの構造
        const data = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            devices: devicesData,
            connections: connectionsData
        };

        // JSONファイルとしてダウンロード
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'network-diagram.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.updateStatus('ネットワーク構成を保存しました');
    }

    // ネットワーク構成を読み込み
    loadNetwork() {
        document.getElementById('file-input').click();
    }

    // ファイル読み込み処理
    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // バージョンチェック
                if (!data.version) {
                    throw new Error('不正なファイル形式です');
                }

                // 現在の構成をクリア
                this.clearAll();

                // デバイスを復元
                const deviceMap = new Map();
                data.devices.forEach(deviceData => {
                    const device = this.createDevice(deviceData.type, deviceData.x, deviceData.y);
                    device.id = deviceData.id;
                    device.name = deviceData.name;
                    device.width = deviceData.width;
                    device.height = deviceData.height;
                    device.config = { ...deviceData.config };
                    
                    // ポートを復元
                    device.ports.nics.forEach((port, index) => {
                        if (deviceData.ports.nics[index]) {
                            const portData = deviceData.ports.nics[index];
                            port.id = portData.id;
                            port.x = portData.x;
                            port.y = portData.y;
                            port.side = portData.side;
                            port.connected = portData.connected;
                        }
                    });

                    this.devices.set(device.id, device);
                    deviceMap.set(device.id, device);
                });

                // 接続を復元
                data.connections.forEach(connectionData => {
                    const fromDevice = deviceMap.get(connectionData.from.deviceId);
                    const toDevice = deviceMap.get(connectionData.to.deviceId);
                    
                    if (fromDevice && toDevice) {
                        const fromPort = fromDevice.ports.nics.find(p => p.id === connectionData.from.portId);
                        const toPort = toDevice.ports.nics.find(p => p.id === connectionData.to.portId);
                        
                        if (fromPort && toPort) {
                            const connection = {
                                id: connectionData.id,
                                from: { device: fromDevice, port: fromPort },
                                to: { device: toDevice, port: toPort }
                            };
                            
                            this.connections.push(connection);
                            fromPort.connected = connection;
                            toPort.connected = connection;
                        }
                    }
                });

                this.updateControlButtons();
                this.scheduleRender();
                this.updateStatus('ネットワーク構成を読み込みました');
                
            } catch (error) {
                console.error('ファイル読み込みエラー:', error);
                this.updateStatus('ファイル読み込みに失敗しました: ' + error.message);
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // ファイル入力をリセット
    }

    // 画像としてエクスポート
    exportImage() {
        // 一時的に背景を白にして画像を生成
        const originalFillStyle = this.ctx.fillStyle;
        
        // 現在のキャンバス内容をクリアして白背景で再描画
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 現在の描画内容を再描画
        this.render();
        
        // PNG画像としてダウンロード
        const link = document.createElement('a');
        link.download = 'network-diagram.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
        
        // 元の描画状態に戻す
        this.ctx.fillStyle = originalFillStyle;
        this.scheduleRender();
        
        this.updateStatus('ネットワーク図を画像として保存しました');
    }
}

// アプリケーション初期化
function initializeNetworkSimulator() {
    // DOM要素の存在確認
    const canvas = document.getElementById('network-canvas');
    if (!canvas) {
        console.warn('Canvas要素が見つかりません。コンポーネント読み込み待ち...');
        return false;
    }
    
    const simulator = new NetworkSimulator();
    
    // グローバルに公開（TCPアニメーション等で使用）
    window.simulator = simulator;
    
    // TCP機能を既存のシミュレーターに統合
    setupTCPIntegration(simulator);
    
    // アニメーション速度制御を初期化
    initializeAnimationSpeedControl();
    
    // TCP表示制御を初期化  
    initializeTCPVisibilityControl();
    
    // ログ表示制御を初期化
    initializeLogVisibilityControl();
    
    return true;
}

// コンポーネント読み込み完了後に初期化
if (window.componentsLoaded) {
    initializeNetworkSimulator();
} else {
    window.addEventListener('componentsLoaded', () => {
        console.log('コンポーネント読み込み完了、シミュレータを初期化中...');
        if (!initializeNetworkSimulator()) {
            // 要素がまだない場合は少し待ってリトライ
            setTimeout(() => {
                initializeNetworkSimulator();
            }, 100);
        }
    });
    
    // フォールバック: componentsLoadedイベントが発火しない場合
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!window.simulator) {
                console.log('フォールバック初期化を実行中...');
                initializeNetworkSimulator();
            }
        }, 500);
    });
}

// デバッグ用のグローバル関数を登録
window.debugDHCP = () => {
    if (window.simulator) {
        window.simulator.showAllDHCPLeases();
    } else {
        console.warn('シミュレーターが初期化されていません');
    }
};

window.debugNetworkDevices = () => {
    if (window.simulator) {
        console.log('\n=== 全デバイス情報 ===');
        for (const [, device] of window.simulator.devices.entries()) {
            const dhcpStatus = device.config.dhcpEnabled ? 'DHCP有効' : 'DHCP無効';
            console.log(`${device.name} (${device.type}): ${device.config.ipAddress} - ${dhcpStatus}`);
        }
        console.log('=== 全デバイス情報終了 ===\n');
    } else {
        console.warn('シミュレーターが初期化されていません');
    }
};

window.redistributeAllDHCP = () => {
    if (window.simulator) {
        console.log('\n=== 全ルーターでDHCP再配布 ===');
        for (const [, device] of window.simulator.devices.entries()) {
            if (device.type === 'router') {
                window.simulator.redistributeDHCPAddresses(device);
            }
        }
    } else {
        console.warn('シミュレーターが初期化されていません');
    }
};

// TCP関連のデバッグコマンド
window.debugTCP = () => {
    if (window.tcpManager) {
        const stats = window.tcpManager.getStatistics();
        console.log('\n=== TCP接続統計 ===');
        console.log(`総接続数: ${stats.totalConnections}`);
        console.log(`アクティブ接続: ${stats.activeConnections}`);
        console.log('状態分布:', stats.stateDistribution);
        console.log('=== TCP接続統計終了 ===\n');
    } else {
        console.warn('TCPマネージャーが初期化されていません');
    }
};

console.log('🔧 デバッグコマンド:');
console.log('  debugDHCP() - DHCP状況表示');
console.log('  debugNetworkDevices() - 全デバイス情報表示');
console.log('  redistributeAllDHCP() - 全ルーターでDHCP再配布実行');
console.log('  debugTCP() - TCP接続統計表示');

// TCP機能を既存のシミュレーターに統合する関数
function setupTCPIntegration(simulator) {
    if (!simulator) {
        console.error('シミュレーターが初期化されていません');
        return;
    }
    
    // HTTP通信モード
    simulator.isHTTPMode = false;
    simulator.httpSourceDevice = null;
    simulator.httpTargetDevice = null;
    
    // HTTP通信ボタンのイベントリスナー
    const httpBtn = document.getElementById('http-btn');
    if (httpBtn) {
        httpBtn.addEventListener('click', () => {
            simulator.toggleHTTPMode();
        });
    }
    
    // TCPマネージャーのイベントリスナー設定
    setupTCPEventListeners(simulator);
    
    // TCP状態パネルの初期化
    setupTCPStatusPanel(simulator);
    
    // デバイスにTCP関連機能を追加
    extendDevicesWithTCP(simulator);
    
    console.log('TCP機能が正常に統合されました');
}

// TCPイベントリスナーの設定
function setupTCPEventListeners(simulator) {
    // TCP接続状態変更イベント
    window.tcpManager.addEventListener('connectionStateChange', (data) => {
        console.log(`TCP状態変更: ${data.connection.id} ${data.oldState} → ${data.newState}`);
        updateTCPStatusPanel(simulator);
    });
    
    // セグメント送信イベント（アニメーション表示）
    window.tcpManager.addEventListener('segmentSent', (data) => {
        // animation-helper.jsのanimateTCPSegment関数を使用
        if (typeof window.animateTCPSegment === 'function') {
            window.animateTCPSegment(simulator, data);
        } else {
            console.error('animateTCPSegment関数が見つかりません（animation-helper.js）');
        }
    });
    
    // HTTP関連イベントはtcp-integration.jsで処理
    
    // 接続確立完了イベント
    window.tcpManager.addEventListener('connectionEstablished', (data) => {
        simulator.updateStatus(`TCP接続確立: ${data.connection.localDevice.name || data.connection.localDevice.id} ⟷ ${data.connection.remoteDevice.name || data.connection.remoteDevice.id}`);
        updateTCPStatusPanel(simulator);
    });
}

// TCP状態パネルの設定
function setupTCPStatusPanel(simulator) {
    const panel = document.getElementById('tcp-status-panel');
    if (panel) {
        // 初期は非表示
        panel.style.display = 'none';
    }
}

// TCP状態パネルの更新
function updateTCPStatusPanel(simulator) {
    const panel = document.getElementById('tcp-status-panel');
    const connectionsList = document.getElementById('tcp-connections-list');
    
    if (!panel || !connectionsList) return;
    
    const connections = window.tcpManager.getAllConnections();
    
    if (connections.length === 0) {
        connectionsList.innerHTML = '<div style="color: #666; font-style: italic;">接続なし</div>';
        // ログ表示がOFFなら非表示、ONなら表示（未定義の場合はfalseとして扱う）
        if (!window.showLogPanels) {
            panel.style.display = 'none';
        }
        return;
    }
    
    // ログ表示がONの場合のみ表示
    if (window.showLogPanels) {
        panel.style.display = 'block';
    }
    
    connectionsList.innerHTML = connections.map(conn => {
        const info = conn.getConnectionInfo();
        const stateClass = info.state.toLowerCase().replace('_', '-');
        const localName = info.localDevice;
        const remoteName = info.remoteDevice;
        
        return `
            <div class="tcp-connection-item ${stateClass}">
                <div style="font-weight: bold;">${localName}:${info.localPort} ⟷ ${remoteName}:${info.remotePort}</div>
                <div style="color: #666; font-size: 10px;">
                    状態: ${info.state} | 送信: ${info.sentSegments} | 受信: ${info.receivedSegments}
                </div>
            </div>
        `;
    }).join('');
}

// TCPセグメントのアニメーション（animation-helper.jsの関数を使用）
// この関数は削除され、animation-helper.jsのanimateTCPSegment関数が使用されます

// ワールド座標をDOM座標に変換する関数
function worldToDOM(simulator, worldPos) {
    return {
        x: worldPos.x * simulator.scale + simulator.panX,
        y: worldPos.y * simulator.scale + simulator.panY
    };
}

// TCP接続に基づいて送信元デバイスを探す関数（簡易実装）
function findDeviceByConnection(segment, targetDevice) {
    // 既存のTCP接続から送信元を探す
    const connections = window.tcpManager.getAllConnections();
    for (const conn of connections) {
        if (conn.remoteDevice === targetDevice && 
            conn.localPort === segment.sourcePort && 
            conn.remotePort === segment.destPort) {
            return conn.localDevice;
        }
    }
    
    // 見つからない場合はnull
    return null;
}

// デバイスにTCP機能を拡張
function extendDevicesWithTCP(simulator) {
    // 既存のデバイス作成関数を拡張
    const originalCreateDevice = simulator.createDevice.bind(simulator);
    simulator.createDevice = function(type, x, y) {
        const device = originalCreateDevice(type, x, y);
        
        // TCP関連機能を追加
        device.receiveSegment = function(segment, connection) {
            console.log(`${this.name || this.id} でTCPセグメント受信:`, segment.toString());
            
            if (connection) {
                connection.receiveSegment(segment);
            } else {
                console.warn('TCP接続が見つかりません:', segment.toString());
            }
        };
        
        // サーバータイプの場合はHTTPサーバー機能を有効にする
        if (type === 'server') {
            window.httpSimulator.setupSampleServer(device, 80);
        }
        
        return device;
    };
    
    // HTTP通信モードの切り替え
    simulator.toggleHTTPMode = function() {
        if (this.isHTTPMode) {
            // HTTP通信モードを終了
            this.isHTTPMode = false;
            this.httpSourceDevice = null;
            this.httpTargetDevice = null;
            this.updateStatus('HTTP通信モードを終了しました');
        } else {
            // HTTP通信モードを開始
            this.isHTTPMode = true;
            this.isPingMode = false; // Pingモードは無効にする
            this.pingSourceDevice = null;
            this.pingTargetDevice = null;
            this.updateStatus('HTTP通信を行うクライアントとサーバーを選択してください');
        }
        this.updateControlButtons(); // ボタンの状態を更新
        this.scheduleRender();
    };
    
    // 既存のデバイスクリックハンドラーを拡張
    const originalHandleDeviceClick = simulator.handleDeviceClick.bind(simulator);
    simulator.handleDeviceClick = function(clickedDevice, event) {
        if (this.isHTTPMode) {
            this.handleHTTPModeClick(clickedDevice);
            return;
        }
        
        // 元の処理を実行
        originalHandleDeviceClick(clickedDevice, event);
    };
    
    // HTTP通信用のデバイスクリック処理
    simulator.handleHTTPModeClick = function(clickedDevice) {
        if (!this.httpSourceDevice) {
            // 送信元を選択
            this.httpSourceDevice = clickedDevice;
            this.updateStatus(`HTTP送信元に ${clickedDevice.name} を選択しました。次にサーバーを選択してください。`);
        } else if (this.httpSourceDevice === clickedDevice) {
            // 同じデバイスをクリック → 選択解除
            this.httpSourceDevice = null;
            this.updateStatus('HTTP送信元の選択を解除しました。クライアントを選択してください。');
        } else {
            // 送信先を選択 → HTTP通信実行
            this.httpTargetDevice = clickedDevice;
            this.executeHTTPCommunication(this.httpSourceDevice, this.httpTargetDevice);
            
            // 通信実行後、送信元・送信先をリセットして次の通信に備える
            this.httpSourceDevice = null;
            this.httpTargetDevice = null;
            this.updateStatus('HTTP通信を実行しました。続けて別の通信を行うか、HTTP終了ボタンを押してください。');
            this.updateControlButtons(); // HTTPモード継続中のためボタン状態を更新
        }
        this.scheduleRender();
    };
    
    // HTTP通信の実行
    simulator.executeHTTPCommunication = function(client, server) {
        console.log(`HTTP通信開始: ${client.name || client.id} → ${server.name || server.id}`);
        
        // IPアドレスの検証
        if (!client.config.ipAddress || client.config.ipAddress === '0.0.0.0') {
            this.updateStatus(`❌ HTTP通信失敗: ${client.name} にIPアドレスが設定されていません`);
            return;
        }
        
        if (!server.config.ipAddress || server.config.ipAddress === '0.0.0.0') {
            this.updateStatus(`❌ HTTP通信失敗: ${server.name} にIPアドレスが設定されていません`);
            return;
        }
        
        // 通信可能性の検証
        const reachabilityResult = this.checkNetworkReachability(client, server);
        if (!reachabilityResult.isReachable) {
            this.updateStatus(`❌ HTTP通信失敗: ${client.name} と ${server.name} は通信できません (${reachabilityResult.reason})`);
            return;
        }
        
        this.updateStatus(`🌐 HTTP通信を開始中: ${client.name} → ${server.name}`);
        
        // HTTPリクエストを送信
        const session = window.httpSimulator.sendRequest(client, server, {
            method: 'GET',
            path: '/',
            headers: {
                'Host': server.config.ipAddress,
                'User-Agent': 'NetworkSimulator/1.0'
            }
        });
        
        if (!session) {
            this.updateStatus(`❌ HTTP通信失敗: セッションの作成に失敗しました`);
        }
    };
    
    // デバイス描画に HTTP モードのハイライトを追加
    const originalDrawDevice = simulator.drawDevice.bind(simulator);
    simulator.drawDevice = function(device) {
        let httpHighlight = null;
        
        if (this.isHTTPMode) {
            if (device === this.httpSourceDevice) {
                httpHighlight = 'source';
            } else if (device === this.httpTargetDevice) {
                httpHighlight = 'target';
            }
        }
        
        // 元の描画処理を呼び出し（引数を拡張）
        originalDrawDevice(device, httpHighlight);
    };
    
    // クリアボタンの処理を拡張
    const originalClearAll = simulator.clearAll.bind(simulator);
    simulator.clearAll = function() {
        // TCP接続をクリア
        window.tcpManager.clearAllConnections();
        window.httpSimulator.clearAllSessions();
        
        // HTTP通信モードをリセット
        this.isHTTPMode = false;
        this.httpSourceDevice = null;
        this.httpTargetDevice = null;
        document.getElementById('http-btn').textContent = 'HTTP';
        
        // TCP状態パネルを隠す
        const panel = document.getElementById('tcp-status-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        
        // 元のクリア処理を実行
        originalClearAll();
    };
}

// TCP機能を統合
console.log('TCP統合を開始...');

// データ受信イベントリスナーを直接追加（重複防止付き）
let httpEventListenerAdded = false;
if (!httpEventListenerAdded) {
    window.tcpManager.addEventListener('dataReceived', (data) => {
        console.log('TCPManager dataReceived:', data.connection.id);
        
        const connection = data.connection;
        const localDevice = connection.localDevice;
        const remoteDevice = connection.remoteDevice;
        
        // TCP接続IDでHTTPセッションを正確に特定
        const targetSessionId = connection.id;
        console.log('HTTPセッション検索対象:', targetSessionId);
        
        const session = window.httpSimulator.sessions.get(targetSessionId);
        if (session) {
            console.log('HTTPセッションに転送:', targetSessionId);
            session.handleReceivedData(data.data);
        } else {
            console.log('対応するHTTPセッションが見つかりません:', targetSessionId);
            console.log('利用可能なHTTPセッション:', Array.from(window.httpSimulator.sessions.keys()));
            
            // まず逆方向のTCP接続IDでHTTPセッションを検索
            const reversedId = window.httpSimulator.getReversedConnectionId ? 
                window.httpSimulator.getReversedConnectionId(targetSessionId) : null;
            
            let matchedSession = null;
            if (reversedId) {
                console.log('逆方向接続ID:', reversedId);
                matchedSession = window.httpSimulator.sessions.get(reversedId);
                if (matchedSession) {
                    console.log('逆方向接続でHTTPセッションに転送:', reversedId);
                    matchedSession.handleReceivedData(data.data);
                }
            }
            
            // 逆方向でも見つからない場合、デバイス間での代替検索（最新のセッションを優先）
            if (!matchedSession) {
                const sessionEntries = Array.from(window.httpSimulator.sessions.entries());
                // セッションを最新順（接続ID内のタイムスタンプが新しい順）にソート
                sessionEntries.sort((a, b) => {
                    const timestampA = a[0].split('_')[0].split('-')[1] || '0';
                    const timestampB = b[0].split('_')[0].split('-')[1] || '0';
                    return parseInt(timestampB) - parseInt(timestampA);
                });
                
                for (const [sessionId, session] of sessionEntries) {
                    const sessionLocal = session.connection.localDevice;
                    const sessionRemote = session.connection.remoteDevice;
                    
                    if ((sessionLocal === localDevice && sessionRemote === remoteDevice) ||
                        (sessionLocal === remoteDevice && sessionRemote === localDevice)) {
                        console.log('デバイスベース（最新優先）でHTTPセッションに転送:', sessionId);
                        session.handleReceivedData(data.data);
                        break;
                    }
                }
            }
        }
    });
    httpEventListenerAdded = true;
}

console.log('TCP-HTTP統合完了');

// アニメーション速度制御の初期化
window.animationSpeedMultiplier = 1.0;

function initializeAnimationSpeedControl() {
    const slider = document.getElementById('animation-speed-slider');
    const speedValue = document.getElementById('speed-value');
    
    if (slider && speedValue) {
        // スライダーの値が変更された時の処理
        slider.addEventListener('input', function() {
            const speed = parseFloat(this.value);
            window.animationSpeedMultiplier = speed;
            speedValue.textContent = speed + '×';
            
            console.log('アニメーション速度を変更:', speed + '×');
        });
        
        // 初期値を設定
        window.animationSpeedMultiplier = parseFloat(slider.value);
        speedValue.textContent = slider.value + '×';
        
        console.log('アニメーション速度制御を初期化しました');
    }
}

// TCP表示制御の初期化
function initializeTCPVisibilityControl() {
    const checkbox = document.getElementById('tcp-visibility-checkbox');
    if (checkbox) {
        // 初期値を設定
        window.showTCPPackets = checkbox.checked;
        
        // チェックボックスの変更イベント
        checkbox.addEventListener('change', (event) => {
            window.showTCPPackets = event.target.checked;
            console.log(`TCP詳細表示: ${window.showTCPPackets ? 'ON (全パケット)' : 'OFF (HTTPデータのみ)'}`);
        });
        
        console.log('TCP表示制御を初期化しました');
    }
}

// ログ表示制御の初期化
function initializeLogVisibilityControl() {
    const checkbox = document.getElementById('log-visibility-checkbox');
    
    if (checkbox) {
        // 初期値を設定
        window.showLogPanels = checkbox.checked;
        
        // チェックボックスの変更イベント
        checkbox.addEventListener('change', (event) => {
            window.showLogPanels = event.target.checked;
            console.log(`ログ表示: ${window.showLogPanels ? 'ON' : 'OFF'}`);
            
            // TCP詳細パネルとHTTPパネルの表示/非表示を制御
            toggleTCPDetailPanels(event.target.checked);
        });
        
        // 初期状態でパネルの表示/非表示を設定
        toggleTCPDetailPanels(checkbox.checked);
        
        console.log('ログ表示制御を初期化しました');
    }
}

// TCP詳細パネルの表示/非表示制御
function toggleTCPDetailPanels(show) {
    const tcpPanel = document.getElementById('tcp-status-panel');
    const httpPanel = document.getElementById('http-status-panel');
    
    if (tcpPanel) {
        tcpPanel.style.display = show ? 'block' : 'none';
    }
    
    if (httpPanel) {
        httpPanel.style.display = show ? 'block' : 'none';
    }
    
    console.log(`ログパネル: ${show ? '表示' : '非表示'}`);
}

// 注意: initializeAnimationSpeedControl() と initializeTCPVisibilityControl() は
// 現在 initializeNetworkSimulator() 内で呼び出されています
