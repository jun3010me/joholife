// アプリケーションの初期化
class MobileCircuitSimulator {
    constructor() {
        this.canvas = document.getElementById('circuit-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.components = new Map();
        this.connections = [];
        this.selectedComponent = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.panX = 0;
        // モバイル・タブレット時は上部の余白を詰めるため、panYを調整
        if (this.isTouchDevice()) {
            this.panY = 20; // 上部の描画位置を20px下げる
        } else {
            this.panY = 0;
        }
        this.history = [];
        this.historyIndex = -1;
        this.isConnecting = false;
        this.connectionStart = null;
        this.currentMousePos = { x: 0, y: 0 };
        this.isSimulating = true;
        this.simulationInterval = null;
        this.isPanning = false;
        this.lastPanPoint = null;
        this.touches = [];
        this.lastPinchDistance = null;
        this.lastPinchCenter = null;
        this.touchStartTime = 0;
        this.touchStartPos = null;
        this.dragThreshold = 10; // ピクセル単位でのドラッグ判定しきい値
        this.selectedConnection = null;
        this.lastClickTime = 0;
        this.doubleClickDelay = 300; // ダブルクリック判定時間（ミリ秒）
        this.lastClickPosition = null; // 最後のクリック位置
        this.overlappingComponents = []; // 重なったコンポーネントのリスト
        
        // パレットスクロール対応
        this.isPaletteScrolling = false;
        this.paletteScrollStartX = 0;
        this.paletteScrollStartY = 0;
        this.paletteScrollThreshold = 10; // スクロール判定を緩く（横スクロール優先）
        this.paletteScrollStartScrollLeft = 0;
        this.pendingComponentDrag = null; // 部品ドラッグ開始待機用
        this.currentOverlapIndex = 0; // 現在選択中の重なりインデックス
        this.nextZIndex = 1; // Z-index管理用カウンター
        this.pendingComponent = null; // パレットからドラッグ中の部品（まだマップに追加されていない）
        this.dragStarted = false; // 実際のドラッグ移動が開始されたかのフラグ
        
        this.init();
    }
    
    // モバイル横画面の判定（CSSメディアクエリと完全統一）
    isMobileLandscape() {
        // CSSと同じ条件：(max-width: 1024px) and (hover: none) and (pointer: coarse) and (orientation: landscape)
        const isLandscape = window.matchMedia('(max-width: 1024px) and (hover: none) and (pointer: coarse) and (orientation: landscape)').matches;
        
        console.log('Landscape detection:', {
            mediaQuery: window.matchMedia('(max-width: 1024px) and (hover: none) and (pointer: coarse) and (orientation: landscape)').matches,
            orientation: window.matchMedia('(orientation: landscape)').matches,
            maxWidth: window.matchMedia('(max-width: 1024px)').matches,
            hoverNone: window.matchMedia('(hover: none)').matches,
            pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            isLandscape: isLandscape
        });
        return isLandscape;
    }

    // タッチデバイスかどうかを判定（iPhone16ProMAX、iPad等に対応）
    isTouchDevice() {
        // PCのタッチスクリーンと真のモバイルデバイスを区別
        const isMobileWidth = window.innerWidth <= 1024;
        const hasTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
        const isPrimaryTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        
        // 幅が1024以下で、かつプライマリ入力デバイスがタッチの場合のみtrue
        return isMobileWidth && hasTouch && isPrimaryTouch;
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupPalette();
        this.setupFileHandling();
        this.drawPaletteIcons();
        this.startSimulation();
        this.render();
    }
    
    startSimulation() {
        this.simulationInterval = setInterval(() => {
            if (this.isSimulating) {
                this.updateSimulation();
            }
        }, 100); // 10Hzでシミュレーション更新
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

        // 画面向き変更とリサイズイベントの処理
        const handleOrientationChange = () => {
            const isDesktop = window.innerWidth > 768;
            if (isDesktop) {
                // PC環境ではクラス管理のみスキップ、キャンバスリサイズは実行
                document.body.classList.remove('landscape', 'large-landscape');
                setTimeout(() => {
                    this.resizeCanvas();
                }, 100);
                return;
            }
            
            const isLandscape = window.innerWidth > window.innerHeight;
            const isShortHeight = window.innerHeight <= 600;
            const isLargeScreen = window.innerWidth >= 844 && isLandscape && isShortHeight;
            
            // CSSクラスを動的に管理（横画面かつ大画面のみ）
            document.body.classList.toggle('landscape', isLandscape && !isLargeScreen);
            document.body.classList.toggle('large-landscape', isLandscape && isLargeScreen);
            
            // 横画面かつ大画面時はパレットを常時表示
            if (isLandscape && isLargeScreen) {
                const palette = document.querySelector('.component-palette');
                const overlay = document.querySelector('.palette-overlay');
                if (palette) {
                    palette.classList.remove('open');
                    // パレットを常時表示状態にする
                    palette.style.transform = 'translateX(0)';
                    palette.style.position = 'relative';
                }
                if (overlay) {
                    overlay.classList.remove('visible');
                }
            }
            
            // キャンバスのリサイズ
            setTimeout(() => {
                this.resizeCanvas();
            }, 100);
        };

        window.addEventListener('resize', handleOrientationChange);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                handleOrientationChange();
                // 部品パレットの再構築を実行
                this.rebuildComponentPalette();
            }, 100);
        });
        
        // 初期化時に実行
        handleOrientationChange();
        
        // メディアクエリの変更を監視
        const landscapeQuery = window.matchMedia('(max-width: 1024px) and (hover: none) and (pointer: coarse) and (orientation: landscape)');
        landscapeQuery.addEventListener('change', () => {
            console.log('Media query changed, rebuilding palette');
            setTimeout(() => {
                this.rebuildComponentPalette();
            }, 100);
        });
    }

    // 画面回転時の部品パレット再構築
    rebuildComponentPalette() {
        console.log('Rebuilding component palette for orientation change');
        
        const isLandscape = this.isMobileLandscape();
        const palette = document.querySelector('.component-palette');
        
        if (!palette) return;
        
        // 現在の画面方向に応じてパレットを再構築
        if (isLandscape) {
            // 横画面用の再構築
            console.log('Rebuilding for landscape mode');
            
            // パレットのスクロール状態をリセット
            this.isPaletteScrolling = false;
            
            // 部品グリッドを横スクロール用に再配置
            const componentGrids = palette.querySelectorAll('.component-grid');
            componentGrids.forEach(grid => {
                // グリッドをフレックスボックスに変更
                grid.style.display = 'flex';
                grid.style.flexDirection = 'row';
                grid.style.flexWrap = 'nowrap';
                grid.style.overflowX = 'visible';
                grid.style.gap = '4px';
                
                // 部品アイテムのサイズを調整（CSSで統一された80pxを維持）
                const items = grid.querySelectorAll('.component-item');
                items.forEach(item => {
                    // CSS設定を優先して動的変更は行わない
                    item.style.flexShrink = '0';
                });
            });
            
            // パレットコンテンツを横スクロール用に調整
            const paletteContent = palette.querySelector('.palette-content');
            if (paletteContent) {
                paletteContent.style.overflowX = 'auto';
                paletteContent.style.overflowY = 'hidden';
                paletteContent.style.display = 'flex';
                paletteContent.style.flexDirection = 'row';
                paletteContent.style.alignItems = 'center';
            }
        } else {
            // 縦画面用の再構築
            console.log('Rebuilding for portrait mode');
            
            // パレットのスクロール状態をリセット
            this.isPaletteScrolling = false;
            
            // 部品グリッドを縦画面用に再配置
            const componentGrids = palette.querySelectorAll('.component-grid');
            componentGrids.forEach(grid => {
                // グリッドをグリッドレイアウトに戻す
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
                grid.style.flexDirection = '';
                grid.style.flexWrap = '';
                grid.style.overflowX = '';
                grid.style.gap = '8px';
                
                // 部品アイテムのサイズを元に戻す（CSS設定を維持）
                const items = grid.querySelectorAll('.component-item');
                items.forEach(item => {
                    // CSS設定を維持して動的変更をリセット
                    item.style.flexShrink = '';
                });
            });
            
            // パレットコンテンツを縦画面用に調整
            const paletteContent = palette.querySelector('.palette-content');
            if (paletteContent) {
                paletteContent.style.overflowX = '';
                paletteContent.style.overflowY = 'auto';
                paletteContent.style.display = '';
                paletteContent.style.flexDirection = '';
                paletteContent.style.alignItems = '';
            }
        }
        
        // レンダリングを更新
        setTimeout(() => {
            this.render();
        }, 50);
    }

    setupEventListeners() {
        // タッチ・マウスイベント
        this.canvas.addEventListener('mousedown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handlePointerUp.bind(this));
        
        // グローバルマウスイベント（キャンバス外でのドラッグ対応）
        this.globalMouseMoveHandler = this.handleGlobalMouseMove.bind(this);
        this.globalMouseUpHandler = this.handleGlobalMouseUp.bind(this);
        
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

        // ピンチズーム
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        // ツールバーボタン（統合後）
        document.getElementById('undo-btn').addEventListener('click', this.undo.bind(this));
        document.getElementById('redo-btn').addEventListener('click', this.redo.bind(this));
    }

    setupPalette() {
        const palette = document.getElementById('component-palette');
        const items = palette.querySelectorAll('.component-item');

        const isTouch = this.isTouchDevice();
        const isNarrowScreen = window.innerWidth <= 1024; // 狭い画面かどうか
        
        console.log('Device detection:', {
            isTouchDevice: isTouch,
            isNarrowScreen: isNarrowScreen,
            width: window.innerWidth,
            hasTouch: ('ontouchstart' in window || navigator.maxTouchPoints > 0),
            primaryTouch: window.matchMedia('(hover: none) and (pointer: coarse)').matches
        });

        // 狭い画面（1024px以下）では常にタッチスクロールを有効化
        if (isNarrowScreen) {
            console.log('Setting up touch event handlers (narrow screen)');
            const paletteContent = document.querySelector('.palette-content');
            if (paletteContent) {
                // パレット全体でのスクロール処理（passive: falseで制御可能に）
                paletteContent.addEventListener('touchstart', this.handlePaletteScrollStart.bind(this), { passive: false });
                paletteContent.addEventListener('touchmove', this.handlePaletteScrollMove.bind(this), { passive: false });
                paletteContent.addEventListener('touchend', this.handlePaletteScrollEnd.bind(this), { passive: false });
            }
            
            // 狭い画面でもマウスイベントは併用（PCとタッチ両対応）
            items.forEach(item => {
                item.addEventListener('mousedown', this.startComponentDrag.bind(this));
                // 個別アイテムのタッチイベントは削除（パレット全体で処理）
            });
        } else {
            console.log('Setting up mouse event handlers (wide screen)');
            // 広い画面ではマウス操作のみ
            items.forEach(item => {
                item.addEventListener('mousedown', this.startComponentDrag.bind(this));
                item.addEventListener('touchstart', this.startComponentDrag.bind(this), { passive: false });
            });
        }
    }

    setupFileHandling() {
        document.getElementById('save-btn').addEventListener('click', this.saveCircuit.bind(this));
        document.getElementById('load-btn').addEventListener('click', this.loadCircuit.bind(this));
        document.getElementById('export-btn').addEventListener('click', this.exportImage.bind(this));
        document.getElementById('file-input').addEventListener('change', this.handleFileLoad.bind(this));
    }

    getPointerPos(event) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;
        
        // タッチイベントかマウスイベントかを判定
        if (event.touches && event.touches.length > 0) {
            // タッチイベントの場合
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            // タッチエンドイベントの場合
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            // マウスイベントの場合
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        // キャンバス外でもドラッグできるように座標変換
        return {
            x: (clientX - rect.left - this.panX) / this.scale,
            y: (clientY - rect.top - this.panY) / this.scale
        };
    }

    // 残りのメソッドも同様に分割します
    // ... (長すぎるため、分割して作成する必要があります)
}

// アプリケーションの開始
document.addEventListener('DOMContentLoaded', () => {
    window.circuitSimulator = new MobileCircuitSimulator();
});