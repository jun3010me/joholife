// sql-engine.js
// SQLコマンドのパース・実行エンジン

class SQLEngine {
    constructor() {
        this.tables = {};
    }

    // データベースシミュレータのテーブルをインポート
    importTables(simulatorTables) {
        this.tables = {};

        // MapまたはArrayに対応
        const tablesArray = simulatorTables instanceof Map
            ? Array.from(simulatorTables.values())
            : simulatorTables;

        for (const table of tablesArray) {
            const tableName = table.name;
            const columns = table.columns.map(col => ({
                name: col.name,
                isPrimaryKey: col.isPrimaryKey || false,
                dataType: col.dataType || 'VARCHAR'
            }));

            const rows = table.sampleData || [];

            this.tables[tableName] = {
                columns: columns,
                rows: rows
            };
        }
    }

    // データベースシミュレータ用のテーブルMapを返す
    exportTables() {
        const simulatorTables = new Map();
        let id = 1;

        for (const [tableName, tableData] of Object.entries(this.tables)) {
            const tableId = id++;
            simulatorTables.set(tableId, {
                id: tableId,
                name: tableName,
                x: 100 + (tableId * 50),
                y: 100 + (tableId * 50),
                width: 300,
                height: 200,
                zIndex: tableId,
                columns: tableData.columns.map((col, idx) => ({
                    id: idx + 1,
                    name: col.name,
                    isPrimaryKey: col.isPrimaryKey,
                    dataType: col.dataType
                })),
                sampleData: tableData.rows
            });
        }

        return simulatorTables;
    }

    // SQLコマンドを実行
    execute(sql) {
        try {
            sql = sql.trim();

            if (!sql) {
                return { success: true, message: '' };
            }

            // セミコロンを削除
            if (sql.endsWith(';')) {
                sql = sql.slice(0, -1).trim();
            }

            // コマンドの種類を判定
            const upperSQL = sql.toUpperCase();

            if (upperSQL.startsWith('SELECT')) {
                return this.executeSelect(sql);
            } else if (upperSQL.startsWith('INSERT')) {
                return this.executeInsert(sql);
            } else if (upperSQL.startsWith('UPDATE')) {
                return this.executeUpdate(sql);
            } else if (upperSQL.startsWith('DELETE')) {
                return this.executeDelete(sql);
            } else if (upperSQL.startsWith('CREATE TABLE')) {
                return this.executeCreateTable(sql);
            } else if (upperSQL.startsWith('DROP TABLE')) {
                return this.executeDropTable(sql);
            } else if (upperSQL.startsWith('SHOW TABLES')) {
                return this.executeShowTables();
            } else if (upperSQL.startsWith('DESC') || upperSQL.startsWith('DESCRIBE')) {
                return this.executeDescribe(sql);
            } else {
                return {
                    success: false,
                    error: `未対応のコマンドです: ${sql.split(' ')[0]}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // SHOW TABLES
    executeShowTables() {
        const tableNames = Object.keys(this.tables);

        if (tableNames.length === 0) {
            return {
                success: true,
                message: 'テーブルが存在しません'
            };
        }

        return {
            success: true,
            table: {
                columns: ['テーブル名'],
                rows: tableNames.map(name => [name])
            }
        };
    }

    // DESCRIBE (DESC)
    executeDescribe(sql) {
        const match = sql.match(/DESC(?:RIBE)?\s+(\S+)/i);

        if (!match) {
            throw new Error('構文エラー: DESC テーブル名');
        }

        const tableName = match[1];

        if (!this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' が存在しません`);
        }

        const table = this.tables[tableName];
        const rows = table.columns.map(col => [
            col.name,
            col.dataType,
            col.isPrimaryKey ? 'PRI' : ''
        ]);

        return {
            success: true,
            table: {
                columns: ['列名', 'データ型', 'キー'],
                rows: rows
            }
        };
    }

    // SELECT文の実行
    executeSelect(sql) {
        // SELECT columns FROM table [WHERE condition]
        const match = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\S+)(?:\s+WHERE\s+(.+))?/i);

        if (!match) {
            throw new Error('構文エラー: SELECT 列名 FROM テーブル名 [WHERE 条件]');
        }

        const columnsStr = match[1].trim();
        const tableName = match[2].trim();
        const whereClause = match[3] ? match[3].trim() : null;

        if (!this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' が存在しません`);
        }

        const table = this.tables[tableName];
        let rows = [...table.rows];

        // WHERE句の処理
        if (whereClause) {
            rows = this.filterRows(rows, whereClause);
        }

        // 列の選択
        let columns;
        let resultRows;

        if (columnsStr === '*') {
            columns = table.columns.map(col => col.name);
            resultRows = rows.map(row => columns.map(col => row[col] || ''));
        } else {
            columns = columnsStr.split(',').map(col => col.trim());

            // 列が存在するか確認
            for (const col of columns) {
                if (!table.columns.find(c => c.name === col)) {
                    throw new Error(`列 '${col}' が存在しません`);
                }
            }

            resultRows = rows.map(row => columns.map(col => row[col] || ''));
        }

        return {
            success: true,
            table: {
                columns: columns,
                rows: resultRows
            },
            message: `${resultRows.length}件のレコードが見つかりました`
        };
    }

    // WHERE句のフィルタリング
    filterRows(rows, whereClause) {
        // 簡易的な実装: 列名 = '値' または 列名 = 値 の形式のみ対応
        const match = whereClause.match(/(\S+)\s*=\s*'?([^']+)'?/);

        if (!match) {
            throw new Error(`WHERE句の構文エラー: ${whereClause}`);
        }

        const column = match[1];
        const value = match[2];

        return rows.filter(row => {
            const rowValue = row[column];
            return rowValue && rowValue.toString() === value;
        });
    }

    // INSERT文の実行
    executeInsert(sql) {
        // INSERT INTO table (columns) VALUES (values)
        const match = sql.match(/INSERT\s+INTO\s+(\S+)\s+\(([^)]+)\)\s+VALUES\s+\(([^)]+)\)/i);

        if (!match) {
            throw new Error('構文エラー: INSERT INTO テーブル名 (列名1, 列名2, ...) VALUES (値1, 値2, ...)');
        }

        const tableName = match[1].trim();
        const columnsStr = match[2].trim();
        const valuesStr = match[3].trim();

        if (!this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' が存在しません`);
        }

        const columns = columnsStr.split(',').map(col => col.trim());
        const values = valuesStr.split(',').map(val => val.trim().replace(/^'|'$/g, ''));

        if (columns.length !== values.length) {
            throw new Error('列数と値の数が一致しません');
        }

        // 新しい行を作成
        const newRow = {};
        for (let i = 0; i < columns.length; i++) {
            newRow[columns[i]] = values[i];
        }

        // 既存の列で値が指定されていないものは空文字列
        for (const col of this.tables[tableName].columns) {
            if (!(col.name in newRow)) {
                newRow[col.name] = '';
            }
        }

        this.tables[tableName].rows.push(newRow);

        return {
            success: true,
            message: '1件のレコードを挿入しました'
        };
    }

    // UPDATE文の実行
    executeUpdate(sql) {
        // UPDATE table SET column = value [WHERE condition]
        const match = sql.match(/UPDATE\s+(\S+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);

        if (!match) {
            throw new Error('構文エラー: UPDATE テーブル名 SET 列名 = 値 [WHERE 条件]');
        }

        const tableName = match[1].trim();
        const setClause = match[2].trim();
        const whereClause = match[3] ? match[3].trim() : null;

        if (!this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' が存在しません`);
        }

        // SET句のパース
        const setMatch = setClause.match(/(\S+)\s*=\s*'?([^']+)'?/);
        if (!setMatch) {
            throw new Error(`SET句の構文エラー: ${setClause}`);
        }

        const updateColumn = setMatch[1];
        const updateValue = setMatch[2];

        let rows = this.tables[tableName].rows;
        let updatedCount = 0;

        // WHERE句がある場合はフィルタリング
        if (whereClause) {
            const filteredRows = this.filterRows(rows, whereClause);

            for (const row of filteredRows) {
                row[updateColumn] = updateValue;
                updatedCount++;
            }
        } else {
            // WHERE句がない場合は全行を更新
            for (const row of rows) {
                row[updateColumn] = updateValue;
                updatedCount++;
            }
        }

        return {
            success: true,
            message: `${updatedCount}件のレコードを更新しました`
        };
    }

    // DELETE文の実行
    executeDelete(sql) {
        // DELETE FROM table [WHERE condition]
        const match = sql.match(/DELETE\s+FROM\s+(\S+)(?:\s+WHERE\s+(.+))?/i);

        if (!match) {
            throw new Error('構文エラー: DELETE FROM テーブル名 [WHERE 条件]');
        }

        const tableName = match[1].trim();
        const whereClause = match[2] ? match[2].trim() : null;

        if (!this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' が存在しません`);
        }

        let rows = this.tables[tableName].rows;
        let deletedCount = 0;

        if (whereClause) {
            // WHERE句がある場合は条件に一致する行を削除
            const beforeCount = rows.length;
            this.tables[tableName].rows = rows.filter(row => {
                const match = whereClause.match(/(\S+)\s*=\s*'?([^']+)'?/);
                if (!match) return true;

                const column = match[1];
                const value = match[2];
                const rowValue = row[column];

                return !(rowValue && rowValue.toString() === value);
            });
            deletedCount = beforeCount - this.tables[tableName].rows.length;
        } else {
            // WHERE句がない場合は全行を削除
            deletedCount = rows.length;
            this.tables[tableName].rows = [];
        }

        return {
            success: true,
            message: `${deletedCount}件のレコードを削除しました`
        };
    }

    // CREATE TABLE文の実行
    executeCreateTable(sql) {
        // CREATE TABLE table_name (column1 type, column2 type PRIMARY KEY, ...)
        const match = sql.match(/CREATE\s+TABLE\s+(\S+)\s+\(([^)]+)\)/i);

        if (!match) {
            throw new Error('構文エラー: CREATE TABLE テーブル名 (列名1 型, 列名2 型 PRIMARY KEY, ...)');
        }

        const tableName = match[1].trim();
        const columnsStr = match[2].trim();

        if (this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' は既に存在します`);
        }

        // 列定義をパース
        const columnDefs = columnsStr.split(',').map(def => def.trim());
        const columns = [];

        for (const def of columnDefs) {
            const parts = def.split(/\s+/);
            const columnName = parts[0];
            const dataType = parts[1] || 'VARCHAR';
            const isPrimaryKey = def.toUpperCase().includes('PRIMARY KEY');

            columns.push({
                name: columnName,
                dataType: dataType,
                isPrimaryKey: isPrimaryKey
            });
        }

        this.tables[tableName] = {
            columns: columns,
            rows: []
        };

        return {
            success: true,
            message: `テーブル '${tableName}' を作成しました`
        };
    }

    // DROP TABLE文の実行
    executeDropTable(sql) {
        const match = sql.match(/DROP\s+TABLE\s+(\S+)/i);

        if (!match) {
            throw new Error('構文エラー: DROP TABLE テーブル名');
        }

        const tableName = match[1].trim();

        if (!this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' が存在しません`);
        }

        delete this.tables[tableName];

        return {
            success: true,
            message: `テーブル '${tableName}' を削除しました`
        };
    }
}

// グローバルインスタンス
window.sqlEngine = new SQLEngine();
