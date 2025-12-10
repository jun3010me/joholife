// sql-terminal.js
// SQLターミナルのUI管理

class SQLTerminal {
    constructor() {
        this.modal = null;
        this.output = null;
        this.input = null;
        this.history = [];
        this.historyIndex = -1;
    }

    init() {
        this.modal = document.getElementById('sql-terminal-modal');
        this.output = document.getElementById('sql-terminal-output');
        this.input = document.getElementById('sql-terminal-input');

        // 閉じるボタン
        const closeBtn = document.getElementById('sql-terminal-close-btn');
        closeBtn.addEventListener('click', () => this.close());

        // モーダルの外側をクリックで閉じる
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Enterキーでコマンド実行、Shift+Enterで改行
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    // Shift+Enterの場合は改行を許可（何もしない）
                    // textareaの高さを自動調整
                    setTimeout(() => this.autoResize(), 0);
                } else {
                    // Enterのみの場合はコマンド実行
                    e.preventDefault();
                    this.executeCommand();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });

        // textareaの入力に応じて高さを自動調整
        this.input.addEventListener('input', () => this.autoResize());

        // 貼り付け時にも高さを自動調整
        this.input.addEventListener('paste', () => {
            setTimeout(() => this.autoResize(), 0);
        });
    }

    open() {
        // シミュレータのテーブルをインポート
        if (window.simulator && window.sqlEngine) {
            window.sqlEngine.importTables(window.simulator.tables);
        }

        this.modal.classList.add('active');
        this.input.focus();
    }

    close() {
        this.modal.classList.remove('active');

        // シミュレータのテーブルを更新
        if (window.simulator && window.sqlEngine) {
            // 既存のテーブルIDと座標情報を保持
            const existingTableInfo = new Map();
            for (const [id, table] of window.simulator.tables.entries()) {
                existingTableInfo.set(table.name, {
                    id: table.id,
                    x: table.x,
                    y: table.y,
                    zIndex: table.zIndex
                });
            }

            // SQLエンジンからテーブルをエクスポート
            const newTables = new Map();
            let nextId = Math.max(...Array.from(window.simulator.tables.keys()), 0) + 1;
            let newTableCount = 0;

            for (const [tableName, tableData] of Object.entries(window.sqlEngine.tables)) {
                let tableId, x, y, zIndex;

                if (existingTableInfo.has(tableName)) {
                    // 既存のテーブルの情報を使用
                    const info = existingTableInfo.get(tableName);
                    tableId = info.id;
                    x = info.x;
                    y = info.y;
                    zIndex = info.zIndex;
                } else {
                    // 新しいテーブルの場合
                    tableId = nextId++;
                    x = 150 + (newTableCount * 80);
                    y = 150 + (newTableCount * 80);
                    zIndex = tableId;
                    newTableCount++;
                }

                newTables.set(tableId, {
                    id: tableId,
                    name: tableName,
                    x: x,
                    y: y,
                    width: 300,
                    height: 200,
                    zIndex: zIndex,
                    columns: tableData.columns.map((col, idx) => ({
                        id: idx + 1,
                        name: col.name,
                        isPrimaryKey: col.isPrimaryKey,
                        dataType: col.dataType
                    })),
                    sampleData: tableData.rows
                });
            }

            if (newTables.size > 0) {
                window.simulator.tables = newTables;
                window.simulator.saveState();
                window.simulator.render();
            }
        }
    }

    executeCommand() {
        const command = this.input.value.trim();

        if (!command) {
            return;
        }

        // コマンドを履歴に追加
        this.history.push(command);
        this.historyIndex = this.history.length;

        // コマンドを表示
        this.appendCommand(command);

        // コマンドを実行
        if (window.sqlEngine) {
            const result = window.sqlEngine.execute(command);
            this.displayResult(result);
        } else {
            this.appendError('SQLエンジンが初期化されていません');
        }

        // 入力欄をクリア
        this.input.value = '';

        // textareaの高さをリセット
        this.input.style.height = 'auto';
        this.input.style.overflowY = 'hidden';

        // 出力を最下部にスクロール
        this.output.scrollTop = this.output.scrollHeight;
    }

    appendCommand(command) {
        const div = document.createElement('div');
        div.className = 'terminal-command';
        div.textContent = `SQL> ${command}`;
        this.output.appendChild(div);
    }

    displayResult(result) {
        // 複数コマンドの結果の場合
        if (result.results && Array.isArray(result.results)) {
            for (const singleResult of result.results) {
                this.displaySingleResult(singleResult);
            }
        } else {
            // 単一コマンドの結果
            this.displaySingleResult(result);
        }
    }

    displaySingleResult(result) {
        if (result.success) {
            if (result.table) {
                // テーブル形式で表示
                this.appendTable(result.table);
            }

            if (result.message) {
                this.appendResult(result.message);
            }
        } else {
            this.appendError(result.error || '不明なエラー');
        }
    }

    appendResult(message) {
        const div = document.createElement('div');
        div.className = 'terminal-result';
        div.textContent = message;
        this.output.appendChild(div);
    }

    appendError(error) {
        const div = document.createElement('div');
        div.className = 'terminal-error';
        div.textContent = `エラー: ${error}`;
        this.output.appendChild(div);
    }

    appendTable(tableData) {
        const table = document.createElement('table');
        table.className = 'terminal-table';

        // ヘッダー
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        for (const column of tableData.columns) {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // ボディ
        const tbody = document.createElement('tbody');

        for (const row of tableData.rows) {
            const tr = document.createElement('tr');

            for (const cell of row) {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);

        this.output.appendChild(table);
    }

    navigateHistory(direction) {
        if (this.history.length === 0) {
            return;
        }

        this.historyIndex += direction;

        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length;
            this.input.value = '';
            return;
        }

        this.input.value = this.history[this.historyIndex];
    }

    clear() {
        // ウェルカムメッセージ以外をクリア
        const welcome = this.output.querySelector('.terminal-welcome');
        this.output.innerHTML = '';
        if (welcome) {
            this.output.appendChild(welcome);
        }
    }

    // textareaの高さを自動調整
    autoResize() {
        if (!this.input) return;

        // 一度高さをリセット
        this.input.style.height = 'auto';

        // コンテンツに合わせて高さを調整（最大10行程度）
        const maxHeight = 200; // 約10行分
        const scrollHeight = this.input.scrollHeight;

        if (scrollHeight > maxHeight) {
            this.input.style.height = maxHeight + 'px';
            this.input.style.overflowY = 'auto';
        } else {
            this.input.style.height = scrollHeight + 'px';
            this.input.style.overflowY = 'hidden';
        }
    }
}

// グローバルインスタンス
window.sqlTerminal = new SQLTerminal();
