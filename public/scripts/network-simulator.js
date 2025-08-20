// ネットワークシミュレータクラス
class NetworkSimulator {
    constructor() {
        this.canvas = document.getElementById('network-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.devices = new Map();
        this.connections = [];
        this.selectedDevice = null;
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

    // デバイスのNICポート情報を取得（入出力兼用）
    getDevicePorts(type) {
        const portConfigs = {
            'pc': {
                nics: [{ id: 'eth', label: 'ETH', x: 1, y: 0.5 }]
            },
            'server': {
                nics: [{ id: 'eth', label: 'ETH', x: 0, y: 0.5 }]
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
            width: 70,
            height: 50,
            config: {
                ipAddress: this.getDefaultIP(deviceType, deviceCount),
                subnetMask: '255.255.255.0',
                defaultGateway: '192.168.1.1'
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
            // ドラッグされずに終了した場合（単純なクリック）
            console.log('単純なクリック検出:', this.selectedDevice.name);
            // デバイスの選択状態は維持する（設定ボタンが有効になる）
            this.updateStatus(`${this.selectedDevice.name}を選択しました（設定ボタンをクリックして設定変更）`);
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
                preventDefault: () => e.preventDefault()
            };
            
            this.handleMouseDown(syntheticEvent);
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
            const fromDevice = this.devices.get(connection.fromDevice);
            const toDevice = this.devices.get(connection.toDevice);
            
            if (!fromDevice || !toDevice) continue;
            
            const fromPort = this.getPortPosition(fromDevice, connection.fromPort);
            const toPort = this.getPortPosition(toDevice, connection.toPort);
            
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
        const portInUse = this.connections.some(conn =>
            (conn.fromDevice === port.device.id && conn.fromPort === port.port.id) ||
            (conn.toDevice === port.device.id && conn.toPort === port.port.id)
        );
        
        if (portInUse) {
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
        const startPortInUse = this.connections.some(conn =>
            (conn.fromDevice === startPort.device.id && conn.fromPort === startPort.port.id) ||
            (conn.toDevice === startPort.device.id && conn.toPort === startPort.port.id)
        );
        
        if (startPortInUse) {
            this.updateStatus(`${startPort.device.name}の${startPort.port.label}は既に接続されています`);
            return;
        }
        
        // 1対1制限：終了ポートが既に接続されているかチェック
        const endPortInUse = this.connections.some(conn =>
            (conn.fromDevice === endPort.device.id && conn.fromPort === endPort.port.id) ||
            (conn.toDevice === endPort.device.id && conn.toPort === endPort.port.id)
        );
        
        if (endPortInUse) {
            this.updateStatus(`${endPort.device.name}の${endPort.port.label}は既に接続されています`);
            return;
        }
        
        // NIC間接続作成（1対1接続）
        const connection = {
            id: 'conn_' + Date.now(),
            fromDevice: startPort.device.id,
            fromPort: startPort.port.id,
            toDevice: endPort.device.id,
            toPort: endPort.port.id,
            type: 'ethernet',
            selected: false
        };
        
        this.connections.push(connection);
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
        
        // 同一サブネット内かチェック
        if (this.isInSameSubnet(sourceIP, targetIP, sourceSubnet)) {
            // 同一サブネット内では直接通信可能
            return { 
                isReachable: true, 
                reason: '同一サブネット内での直接通信',
                routingType: 'direct'
            };
        }
        
        // 異なるサブネット間では、ルーターが必要
        const sourceNetworkAddr = this.getNetworkAddress(sourceIP, sourceSubnet);
        const targetNetworkAddr = this.getNetworkAddress(targetIP, targetSubnet);
        
        // 経路上にルーターがあるかチェック
        const path = this.findPath(sourceDevice, targetDevice);
        const hasRouter = path.some(device => device.type === 'router');
        
        if (!hasRouter) {
            return { 
                isReachable: false, 
                reason: `異なるサブネット間の通信にはルーターが必要です (${sourceNetworkAddr} → ${targetNetworkAddr})`
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
        
        return { 
            isReachable: true, 
            reason: `ルーター経由での通信 (${sourceNetworkAddr} → ${targetNetworkAddr})`,
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
    
    // 同一サブネット内かチェック
    isInSameSubnet(ip1, ip2, subnet) {
        const network1 = this.getNetworkAddress(ip1, subnet);
        const network2 = this.getNetworkAddress(ip2, subnet);
        return network1 === network2;
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
        
        // エラーアニメーション（デバイスを赤く点滅）
        await this.animatePingError(sourceDevice, targetDevice);
        
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
    
    // Pingエラーアニメーション
    async animatePingError(sourceDevice, targetDevice) {
        // 失敗したパケットのアニメーション
        try {
            // エラー表示用の赤いパケットを少し動かしてから停止
            this.updateStatus(`🚀 Ping送信中... ${sourceDevice.config.ipAddress} → ${targetDevice.config.ipAddress}`);
            
            // 短いアニメーション（失敗を表現）
            await this.animateFailedPacket(sourceDevice, targetDevice);
            
            // デバイスを赤く点滅させる
            await this.blinkDevicesRed([sourceDevice, targetDevice]);
            
        } catch (error) {
            console.log('Error animation failed:', error);
        }
    }
    
    // 失敗パケットのアニメーション
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
            await this.animatePacketAlongPath(path, '🔵 ICMP Request', '#2196f3');
            
            await this.sleep(300);
            
            // ICMP Reply（送信先 → 送信元）
            this.updateStatus(`⬅️ ICMP Reply受信: ${targetDevice.config.ipAddress} → ${sourceDevice.config.ipAddress}`);
            const reversePath = [...path].reverse();
            await this.animatePacketAlongPath(reversePath, '🟢 ICMP Reply', '#4caf50');
            
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
    
    // 経路に沿ったパケットアニメーション
    async animatePacketAlongPath(path, label, color) {
        if (path.length < 2) return;
        
        for (let i = 0; i < path.length - 1; i++) {
            await this.animatePacket(path[i], path[i + 1], label, color);
            await this.sleep(200); // 各ホップ間での遅延
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

    // パケットアニメーション（接続線と完全に同じ軌跡）
    async animatePacket(fromDevice, toDevice, label, color) {
        return new Promise((resolve) => {
            const connectionPath = this.getConnectionPath(fromDevice, toDevice);
            
            const packet = {
                x: connectionPath.startX,
                y: connectionPath.startY,
                label,
                color,
                progress: 0,
                path: connectionPath
            };
            
            const duration = 1000; // 1秒
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
        
        document.getElementById('dialog-overlay').style.display = 'block';
        document.getElementById('device-config-dialog').style.display = 'block';
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
        
        // IPアドレスの簡単な検証
        if (!this.isValidIP(ipAddress)) {
            alert('有効なIPアドレスを入力してください');
            return;
        }
        
        this.currentDeviceConfig.name = name;
        this.currentDeviceConfig.config.ipAddress = ipAddress;
        this.currentDeviceConfig.config.subnetMask = subnetMask;
        this.currentDeviceConfig.config.defaultGateway = defaultGateway;
        
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
        
        document.getElementById('config-btn').disabled = !hasSelectedDevice || this.isPingMode;
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
        const fromDevice = this.devices.get(connection.fromDevice);
        const toDevice = this.devices.get(connection.toDevice);
        
        if (!fromDevice || !toDevice) return;
        
        // 接続元と接続先の端子位置を取得
        const fromPort = this.getPortPosition(fromDevice, connection.fromPort);
        const toPort = this.getPortPosition(toDevice, connection.toPort);
        
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

    // 個別デバイス描画
    drawDevice(device) {
        const isSelected = this.selectedDevice && this.selectedDevice.id === device.id;
        const isConnectionStart = this.connectionStart && this.connectionStart.id === device.id;
        
        // Pingエラー点滅の表示
        const isErrorBlinking = this.errorBlinkDevices && this.errorBlinkDevices.has(device.id);
        
        // Pingモードでの特別な表示
        let pingHighlight = '';
        if (this.isPingMode) {
            if (device === this.pingSourceDevice) {
                pingHighlight = 'source'; // 青色
            } else if (device === this.pingTargetDevice) {
                pingHighlight = 'target'; // 赤色
            }
        }
        
        // デバイス本体
        this.ctx.fillStyle = isErrorBlinking ? '#ffebee' : this.getDeviceColor(device.type); // エラー時は薄い赤の背景
        
        if (isErrorBlinking) {
            // エラー点滅時は赤い太い境界線
            this.ctx.strokeStyle = '#f44336';
            this.ctx.lineWidth = 5;
        } else if (pingHighlight === 'source') {
            this.ctx.strokeStyle = '#2196f3'; // 送信元は青
            this.ctx.lineWidth = 4;
        } else if (pingHighlight === 'target') {
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
            device.y + device.height / 2 - 2
        );
        
        // デバイス名
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#333';
        let displayName = device.name;
        
        // Pingモードでのインジケーター追加
        if (pingHighlight === 'source') {
            displayName = '🔵 ' + device.name + ' (送信元)';
            this.ctx.fillStyle = '#2196f3';
        } else if (pingHighlight === 'target') {
            displayName = '🔴 ' + device.name + ' (送信先)';
            this.ctx.fillStyle = '#f44336';
        }
        
        this.ctx.fillText(
            displayName,
            device.x + device.width / 2,
            device.y + device.height - 6
        );
        
        // IPアドレス表示（選択時）
        if (isSelected) {
            this.ctx.font = '9px Arial';
            this.ctx.fillStyle = '#666';
            this.ctx.fillText(
                device.config.ipAddress,
                device.x + device.width / 2,
                device.y + device.height + 12
            );
        }
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
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new NetworkSimulator();
});