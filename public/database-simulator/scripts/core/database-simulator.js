// データベースシミュレータクラス
class DatabaseSimulator {
    constructor() {
        this.canvas = document.getElementById('database-canvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.tables = new Map();
        this.relations = [];
        this.selectedTable = null;
        this.selectedColumn = null;
        this.selectedColumns = new Set();

        // ドラッグ&ドロップ関連
        this.isDraggingTable = false;
        this.isDraggingColumn = false;
        this.draggedTable = null;
        this.draggedColumn = null;
        this.draggedFromTable = null;
        this.dragOffset = { x: 0, y: 0 };

        // ビューポート関連
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastPanPoint = null;

        // タッチ操作関連
        this.touches = [];
        this.lastPinchDistance = null;
        this.touchStartTime = 0;
        this.touchStartPos = null;
        this.isLongPress = false;

        // マウス位置
        this.currentMousePos = { x: 0, y: 0 };

        // ID管理
        this.nextTableId = 1;
        this.nextColumnId = 1;

        // レンダリング最適化
        this.renderScheduled = false;

        // コンテキストメニュー
        this.contextMenuVisible = false;
        this.contextMenuPos = { x: 0, y: 0 };

        this.init();
    }

    isTouchDevice() {
        const isMobileWidth = window.innerWidth <= 1024;
        const hasTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
        const isPrimaryTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        return isMobileWidth && hasTouch && isPrimaryTouch;
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadSampleData();
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
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));

        // タッチイベント
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

        // ボタンイベント
        const addTableBtn = document.getElementById('add-table-btn');
        const resetBtn = document.getElementById('reset-btn');
        const saveBtn = document.getElementById('save-db-btn');
        const loadBtn = document.getElementById('load-db-btn');
        const helpToggleBtn = document.getElementById('help-toggle-btn');
        const helpCloseBtn = document.getElementById('help-close-btn');

        if (addTableBtn) addTableBtn.addEventListener('click', () => this.addNewTable());
        if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveDatabase());
        if (loadBtn) loadBtn.addEventListener('click', () => this.loadDatabase());
        if (helpToggleBtn) helpToggleBtn.addEventListener('click', () => this.toggleHelp());
        if (helpCloseBtn) helpCloseBtn.addEventListener('click', () => this.toggleHelp());
    }

    // ヘルプパネルの表示/非表示を切り替え
    toggleHelp() {
        const helpPanel = document.getElementById('help-panel');
        if (helpPanel) {
            helpPanel.classList.toggle('show');
        }
    }

    // サンプルデータを読み込み
    loadSampleData() {
        // 図書館貸出管理の非正規化テーブル
        const table1 = {
            id: this.nextTableId++,
            name: '貸出管理テーブル',
            x: 100,
            y: 100,
            width: 600,
            height: 300,
            columns: [
                { id: this.nextColumnId++, name: '貸出ID', isPrimaryKey: true, dataType: 'INT' },
                { id: this.nextColumnId++, name: '会員番号', isPrimaryKey: false, dataType: 'INT' },
                { id: this.nextColumnId++, name: '会員氏名', isPrimaryKey: false, dataType: 'VARCHAR' },
                { id: this.nextColumnId++, name: '電話番号', isPrimaryKey: false, dataType: 'VARCHAR' },
                { id: this.nextColumnId++, name: '登録日', isPrimaryKey: false, dataType: 'DATE' },
                { id: this.nextColumnId++, name: 'ISBN', isPrimaryKey: false, dataType: 'VARCHAR' },
                { id: this.nextColumnId++, name: '書籍名', isPrimaryKey: false, dataType: 'VARCHAR' },
                { id: this.nextColumnId++, name: '著者', isPrimaryKey: false, dataType: 'VARCHAR' },
                { id: this.nextColumnId++, name: '出版社', isPrimaryKey: false, dataType: 'VARCHAR' },
                { id: this.nextColumnId++, name: '出版年', isPrimaryKey: false, dataType: 'INT' },
                { id: this.nextColumnId++, name: '貸出日', isPrimaryKey: false, dataType: 'DATE' },
                { id: this.nextColumnId++, name: '返却予定日', isPrimaryKey: false, dataType: 'DATE' }
            ],
            sampleData: [
                ['L001', 'M001', '田中太郎', '090-1111-2222', '2023-04-01', '978-1111', 'データベース入門', '山田一郎', 'A出版', '2023', '2024-01-10', '2024-01-24'],
                ['L002', 'M002', '鈴木花子', '090-3333-4444', '2023-05-15', '978-3333', 'Python入門', '高橋三郎', 'C出版', '2023', '2024-01-11', '2024-01-25']
            ]
        };

        this.tables.set(table1.id, table1);
    }

    // 新しいテーブルを追加
    addNewTable() {
        const name = prompt('テーブル名を入力してください:', `新しいテーブル${this.nextTableId}`);
        if (!name || !name.trim()) return;

        const newTable = {
            id: this.nextTableId++,
            name: name.trim(),
            x: 150 + (this.tables.size * 50),
            y: 150 + (this.tables.size * 50),
            width: 300,
            height: 150,
            columns: [],
            sampleData: []
        };

        this.tables.set(newTable.id, newTable);
        this.render();
    }

    // リセット
    reset() {
        if (!confirm('最初の状態に戻しますか？')) return;

        this.tables.clear();
        this.relations = [];
        this.selectedTable = null;
        this.selectedColumn = null;
        this.selectedColumns.clear();
        this.nextTableId = 1;
        this.nextColumnId = 1;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;

        this.loadSampleData();
        this.render();
    }

    // Canvas座標をワールド座標に変換
    canvasToWorld(x, y) {
        return {
            x: (x - this.panX) / this.scale,
            y: (y - this.panY) / this.scale
        };
    }

    // ワールド座標をCanvas座標に変換
    worldToCanvas(x, y) {
        return {
            x: x * this.scale + this.panX,
            y: y * this.scale + this.panY
        };
    }

    // テーブルを描画
    drawTable(table) {
        const pos = this.worldToCanvas(table.x, table.y);
        const width = table.width * this.scale;
        const height = table.height * this.scale;
        const headerHeight = 40 * this.scale;
        const rowHeight = 30 * this.scale;

        // テーブルの影
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;

        // テーブルの背景
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(pos.x, pos.y, width, height);

        // 影をリセット
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;

        // テーブルのボーダー
        this.ctx.strokeStyle = this.selectedTable === table.id ? '#3b82f6' : '#cbd5e1';
        this.ctx.lineWidth = this.selectedTable === table.id ? 3 : 2;
        this.ctx.strokeRect(pos.x, pos.y, width, height);

        // ヘッダー
        this.ctx.fillStyle = '#4f46e5';
        this.ctx.fillRect(pos.x, pos.y, width, headerHeight);

        // テーブル名
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${16 * this.scale}px sans-serif`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('📋 ' + table.name, pos.x + 10 * this.scale, pos.y + headerHeight / 2);

        // 列を描画
        let currentY = pos.y + headerHeight;
        table.columns.forEach((column, index) => {
            // 列の背景
            if (this.selectedColumns.has(column.id)) {
                this.ctx.fillStyle = '#bfdbfe';
            } else if (column.isPrimaryKey) {
                this.ctx.fillStyle = '#fde68a';
            } else {
                this.ctx.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
            }
            this.ctx.fillRect(pos.x, currentY, width, rowHeight);

            // 列のボーダー
            this.ctx.strokeStyle = '#e2e8f0';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(pos.x, currentY, width, rowHeight);

            // 主キーアイコン
            this.ctx.fillStyle = '#1e293b';
            this.ctx.font = `${14 * this.scale}px sans-serif`;
            this.ctx.textAlign = 'left';
            const icon = column.isPrimaryKey ? '🔑 ' : '';
            this.ctx.fillText(icon + column.name + ' (' + column.dataType + ')', pos.x + 10 * this.scale, currentY + rowHeight / 2);

            currentY += rowHeight;
        });

        // テーブルの高さを動的に調整
        table.height = headerHeight / this.scale + (table.columns.length * rowHeight / this.scale) + 10;
    }

    // リレーションを描画
    drawRelations() {
        this.relations.forEach(relation => {
            const fromTable = this.tables.get(relation.fromTable);
            const toTable = this.tables.get(relation.toTable);

            if (!fromTable || !toTable) return;

            const fromPos = this.worldToCanvas(fromTable.x + fromTable.width, fromTable.y + fromTable.height / 2);
            const toPos = this.worldToCanvas(toTable.x, toTable.y + toTable.height / 2);

            // 矢印を描画
            this.ctx.strokeStyle = '#10b981';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(fromPos.x, fromPos.y);
            this.ctx.lineTo(toPos.x, toPos.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // 矢印の先端
            const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
            const arrowSize = 10;
            this.ctx.fillStyle = '#10b981';
            this.ctx.beginPath();
            this.ctx.moveTo(toPos.x, toPos.y);
            this.ctx.lineTo(
                toPos.x - arrowSize * Math.cos(angle - Math.PI / 6),
                toPos.y - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            this.ctx.lineTo(
                toPos.x - arrowSize * Math.cos(angle + Math.PI / 6),
                toPos.y - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            this.ctx.closePath();
            this.ctx.fill();
        });
    }

    // レンダリング
    render() {
        if (this.renderScheduled) return;

        this.renderScheduled = true;
        requestAnimationFrame(() => {
            this.renderScheduled = false;

            // キャンバスをクリア
            const dpr = window.devicePixelRatio || 1;
            this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

            // 背景
            this.ctx.fillStyle = '#f1f5f9';
            this.ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

            // リレーションを描画
            this.drawRelations();

            // テーブルを描画
            this.tables.forEach(table => {
                this.drawTable(table);
            });
        });
    }

    // 指定座標のテーブルを取得
    getTableAt(x, y) {
        const worldPos = this.canvasToWorld(x, y);

        for (const [id, table] of this.tables) {
            if (worldPos.x >= table.x && worldPos.x <= table.x + table.width &&
                worldPos.y >= table.y && worldPos.y <= table.y + table.height) {
                return table;
            }
        }
        return null;
    }

    // 指定座標の列を取得
    getColumnAt(table, x, y) {
        if (!table) return null;

        const worldPos = this.canvasToWorld(x, y);
        const headerHeight = 40;
        const rowHeight = 30;
        const relativeY = worldPos.y - table.y - headerHeight;

        if (relativeY < 0) return null;

        const columnIndex = Math.floor(relativeY / rowHeight);
        if (columnIndex >= 0 && columnIndex < table.columns.length) {
            return { column: table.columns[columnIndex], index: columnIndex };
        }

        return null;
    }

    // マウスダウン
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const table = this.getTableAt(x, y);

        if (e.button === 2) return; // 右クリックはコンテキストメニュー

        if (table) {
            const columnInfo = this.getColumnAt(table, x, y);

            if (columnInfo) {
                // 列をクリック
                if (e.ctrlKey || e.metaKey) {
                    // 複数選択
                    if (this.selectedColumns.has(columnInfo.column.id)) {
                        this.selectedColumns.delete(columnInfo.column.id);
                    } else {
                        this.selectedColumns.add(columnInfo.column.id);
                    }
                } else {
                    this.selectedColumns.clear();
                    this.selectedColumns.add(columnInfo.column.id);
                }

                this.draggedColumn = columnInfo.column.id;
                this.draggedFromTable = table.id;
                this.isDraggingColumn = true;
            } else {
                // テーブルヘッダーをクリック
                this.selectedTable = table.id;
                this.isDraggingTable = true;
                this.draggedTable = table;

                const worldPos = this.canvasToWorld(x, y);
                this.dragOffset = {
                    x: worldPos.x - table.x,
                    y: worldPos.y - table.y
                };
            }
        } else {
            // 空白をクリック（パン開始）
            this.isPanning = true;
            this.lastPanPoint = { x, y };
            this.selectedTable = null;
            this.selectedColumns.clear();
        }

        this.render();
    }

    // マウスムーブ
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.currentMousePos = { x, y };

        if (this.isDraggingTable && this.draggedTable) {
            const worldPos = this.canvasToWorld(x, y);
            this.draggedTable.x = worldPos.x - this.dragOffset.x;
            this.draggedTable.y = worldPos.y - this.dragOffset.y;
            this.render();
        } else if (this.isPanning && this.lastPanPoint) {
            const dx = x - this.lastPanPoint.x;
            const dy = y - this.lastPanPoint.y;
            this.panX += dx;
            this.panY += dy;
            this.lastPanPoint = { x, y };
            this.render();
        }

        // カーソルの変更
        const table = this.getTableAt(x, y);
        this.canvas.style.cursor = table ? 'move' : 'default';
    }

    // マウスアップ
    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isDraggingColumn) {
            // 列のドロップ先を確認
            const targetTable = this.getTableAt(x, y);

            if (targetTable && targetTable.id !== this.draggedFromTable) {
                // 別のテーブルに列を移動
                this.moveColumns(Array.from(this.selectedColumns), this.draggedFromTable, targetTable.id);
            }

            this.isDraggingColumn = false;
            this.draggedColumn = null;
            this.draggedFromTable = null;
        }

        this.isDraggingTable = false;
        this.draggedTable = null;
        this.isPanning = false;
        this.lastPanPoint = null;

        this.render();
    }

    // ホイールズーム
    handleWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldPosBefore = this.canvasToWorld(mouseX, mouseY);

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale = Math.max(0.1, Math.min(3, this.scale * zoomFactor));

        const worldPosAfter = this.canvasToWorld(mouseX, mouseY);

        this.panX += (worldPosAfter.x - worldPosBefore.x) * this.scale;
        this.panY += (worldPosAfter.y - worldPosBefore.y) * this.scale;

        this.render();
    }

    // コンテキストメニュー
    handleContextMenu(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const table = this.getTableAt(x, y);
        if (!table) return;

        const columnInfo = this.getColumnAt(table, x, y);
        if (!columnInfo) return;

        // 主キーをトグル
        columnInfo.column.isPrimaryKey = !columnInfo.column.isPrimaryKey;

        // 自動的にリレーションを検出
        this.detectRelations();

        this.render();
    }

    // タッチスタート
    handleTouchStart(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);

        if (this.touches.length === 1) {
            const touch = this.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            this.touchStartTime = Date.now();
            this.touchStartPos = { x, y };

            // ロングプレス検出
            this.longPressTimer = setTimeout(() => {
                this.isLongPress = true;
                const table = this.getTableAt(x, y);
                if (table) {
                    const columnInfo = this.getColumnAt(table, x, y);
                    if (columnInfo) {
                        columnInfo.column.isPrimaryKey = !columnInfo.column.isPrimaryKey;
                        this.detectRelations();
                        this.render();

                        // 触覚フィードバック
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }
                }
            }, 500);
        } else if (this.touches.length === 2) {
            // ピンチズーム開始
            this.lastPinchDistance = this.getPinchDistance();
            this.lastPinchCenter = this.getPinchCenter();
        }
    }

    // タッチムーブ
    handleTouchMove(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);

        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        if (this.touches.length === 1 && !this.isLongPress) {
            const touch = this.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // パンまたはテーブルドラッグ
            if (this.isDraggingTable && this.draggedTable) {
                const worldPos = this.canvasToWorld(x, y);
                this.draggedTable.x = worldPos.x - this.dragOffset.x;
                this.draggedTable.y = worldPos.y - this.dragOffset.y;
                this.render();
            } else if (this.touchStartPos) {
                const dx = x - this.touchStartPos.x;
                const dy = y - this.touchStartPos.y;

                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    // テーブルドラッグを開始
                    if (!this.isDraggingTable) {
                        const table = this.getTableAt(this.touchStartPos.x, this.touchStartPos.y);
                        if (table) {
                            this.isDraggingTable = true;
                            this.draggedTable = table;
                            const worldPos = this.canvasToWorld(this.touchStartPos.x, this.touchStartPos.y);
                            this.dragOffset = {
                                x: worldPos.x - table.x,
                                y: worldPos.y - table.y
                            };
                        } else {
                            // パン
                            this.panX += dx;
                            this.panY += dy;
                            this.touchStartPos = { x, y };
                            this.render();
                        }
                    }
                }
            }
        } else if (this.touches.length === 2) {
            // ピンチズーム
            const currentDistance = this.getPinchDistance();
            const currentCenter = this.getPinchCenter();

            if (this.lastPinchDistance && this.lastPinchCenter) {
                const zoomFactor = currentDistance / this.lastPinchDistance;
                const worldPosBefore = this.canvasToWorld(currentCenter.x, currentCenter.y);

                this.scale = Math.max(0.1, Math.min(3, this.scale * zoomFactor));

                const worldPosAfter = this.canvasToWorld(currentCenter.x, currentCenter.y);

                this.panX += (worldPosAfter.x - worldPosBefore.x) * this.scale;
                this.panY += (worldPosAfter.y - worldPosBefore.y) * this.scale;

                this.render();
            }

            this.lastPinchDistance = currentDistance;
            this.lastPinchCenter = currentCenter;
        }
    }

    // タッチエンド
    handleTouchEnd(e) {
        e.preventDefault();

        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        if (this.touches.length === 1 && !this.isLongPress && this.touchStartPos) {
            const touch = this.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            const timeDiff = Date.now() - this.touchStartTime;
            const distance = Math.sqrt(
                Math.pow(x - this.touchStartPos.x, 2) +
                Math.pow(y - this.touchStartPos.y, 2)
            );

            // タップ判定
            if (timeDiff < 300 && distance < 10) {
                const table = this.getTableAt(x, y);
                if (table) {
                    this.selectedTable = table.id;
                    const columnInfo = this.getColumnAt(table, x, y);
                    if (columnInfo) {
                        if (this.selectedColumns.has(columnInfo.column.id)) {
                            this.selectedColumns.delete(columnInfo.column.id);
                        } else {
                            this.selectedColumns.add(columnInfo.column.id);
                        }
                    }
                } else {
                    this.selectedTable = null;
                    this.selectedColumns.clear();
                }
                this.render();
            }
        }

        this.touches = Array.from(e.touches);
        this.isDraggingTable = false;
        this.draggedTable = null;
        this.isLongPress = false;
        this.touchStartPos = null;

        if (this.touches.length === 0) {
            this.lastPinchDistance = null;
            this.lastPinchCenter = null;
        }
    }

    // ピンチ距離を取得
    getPinchDistance() {
        if (this.touches.length < 2) return 0;
        const dx = this.touches[0].clientX - this.touches[1].clientX;
        const dy = this.touches[0].clientY - this.touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ピンチ中心を取得
    getPinchCenter() {
        if (this.touches.length < 2) return { x: 0, y: 0 };
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (this.touches[0].clientX + this.touches[1].clientX) / 2 - rect.left,
            y: (this.touches[0].clientY + this.touches[1].clientY) / 2 - rect.top
        };
    }

    // 列を移動
    moveColumns(columnIds, fromTableId, toTableId) {
        const fromTable = this.tables.get(fromTableId);
        const toTable = this.tables.get(toTableId);

        if (!fromTable || !toTable) return;

        const columnsToMove = fromTable.columns.filter(c => columnIds.includes(c.id));

        // 主キーと非主キーを分離
        const primaryKeyColumns = columnsToMove.filter(c => c.isPrimaryKey);
        const nonPrimaryKeyColumns = columnsToMove.filter(c => !c.isPrimaryKey);

        // 主キー列はコピー（外部キーとして扱う）
        const copiedPrimaryKeys = primaryKeyColumns.map(c => ({
            ...c,
            id: this.nextColumnId++,
            isPrimaryKey: false
        }));

        // 非主キー列は移動
        fromTable.columns = fromTable.columns.filter(c => !nonPrimaryKeyColumns.some(nc => nc.id === c.id));

        // 移動先に追加
        toTable.columns = toTable.columns.concat(copiedPrimaryKeys, nonPrimaryKeyColumns);

        // リレーションを検出
        this.detectRelations();

        this.selectedColumns.clear();
        this.render();
    }

    // リレーションを自動検出
    detectRelations() {
        this.relations = [];

        // 全テーブルの主キーを収集
        const primaryKeys = new Map();
        this.tables.forEach((table, tableId) => {
            table.columns.forEach(column => {
                if (column.isPrimaryKey) {
                    primaryKeys.set(column.name, tableId);
                }
            });
        });

        // 外部キーを検出（他のテーブルの主キーと同名の列）
        this.tables.forEach((table, tableId) => {
            table.columns.forEach(column => {
                if (!column.isPrimaryKey && primaryKeys.has(column.name)) {
                    const fromTableId = primaryKeys.get(column.name);
                    if (fromTableId !== tableId) {
                        this.relations.push({
                            fromTable: fromTableId,
                            toTable: tableId,
                            columnName: column.name
                        });
                    }
                }
            });
        });
    }

    // データベースを保存
    saveDatabase() {
        const data = {
            tables: Array.from(this.tables.values()),
            relations: this.relations,
            nextTableId: this.nextTableId,
            nextColumnId: this.nextColumnId
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `database_${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // データベースを読み込み
    loadDatabase() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    this.tables.clear();
                    data.tables.forEach(table => {
                        this.tables.set(table.id, table);
                    });

                    this.relations = data.relations || [];
                    this.nextTableId = data.nextTableId || 1;
                    this.nextColumnId = data.nextColumnId || 1;

                    this.render();
                } catch (error) {
                    alert('ファイルの読み込みに失敗しました: ' + error.message);
                }
            };

            reader.readAsText(file);
        };

        input.click();
    }
}

// ページ読み込み後に初期化
document.addEventListener('DOMContentLoaded', () => {
    window.dbSimulator = new DatabaseSimulator();
});
