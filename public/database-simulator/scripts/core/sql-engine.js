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

    // SQLコマンドを実行（セミコロン区切りの複数コマンド対応）
    execute(sql) {
        try {
            sql = sql.trim();

            if (!sql) {
                return { success: true, message: '', results: [] };
            }

            // セミコロンで分割して複数コマンドを抽出
            const commands = sql.split(';')
                .map(cmd => cmd.trim())
                .filter(cmd => cmd.length > 0);

            // コマンドが1つの場合は従来の動作
            if (commands.length === 1) {
                return this.executeSingleCommand(commands[0]);
            }

            // 複数コマンドの場合は順次実行
            const results = [];
            for (const command of commands) {
                const result = this.executeSingleCommand(command);
                results.push(result);

                // エラーが発生した場合は処理を中断
                if (!result.success) {
                    break;
                }
            }

            return {
                success: true,
                results: results
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 単一のSQLコマンドを実行
    executeSingleCommand(sql) {
        try {
            sql = sql.trim();

            if (!sql) {
                return { success: true, message: '' };
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
        // JOINを含むかチェック
        const joinMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\S+)\s+((?:INNER\s+|LEFT\s+|RIGHT\s+)?JOIN)\s+(\S+)\s+ON\s+(\S+)\s*=\s*(\S+)(?:\s+WHERE\s+(.+))?/i);

        if (joinMatch) {
            return this.executeSelectWithJoin(sql, joinMatch);
        }

        // 通常のSELECT文
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

    // JOIN付きSELECT文の実行
    executeSelectWithJoin(sql, joinMatch) {
        const columnsStr = joinMatch[1].trim();
        const table1Name = joinMatch[2].trim();
        const joinType = joinMatch[3].trim().toUpperCase();
        const table2Name = joinMatch[4].trim();
        const joinCol1 = joinMatch[5].trim();
        const joinCol2 = joinMatch[6].trim();
        const whereClause = joinMatch[7] ? joinMatch[7].trim() : null;

        // テーブルの存在確認
        if (!this.tables[table1Name]) {
            throw new Error(`テーブル '${table1Name}' が存在しません`);
        }
        if (!this.tables[table2Name]) {
            throw new Error(`テーブル '${table2Name}' が存在しません`);
        }

        const table1 = this.tables[table1Name];
        const table2 = this.tables[table2Name];

        // 結合列名を解析（テーブル名.列名 の形式に対応）
        const col1Parts = joinCol1.split('.');
        const col1Name = col1Parts.length > 1 ? col1Parts[1] : col1Parts[0];

        const col2Parts = joinCol2.split('.');
        const col2Name = col2Parts.length > 1 ? col2Parts[1] : col2Parts[0];

        // JOIN処理
        let joinedRows = [];

        if (joinType === 'JOIN' || joinType === 'INNER JOIN') {
            // INNER JOIN
            joinedRows = this.innerJoin(table1.rows, table2.rows, col1Name, col2Name, table1Name, table2Name);
        } else if (joinType === 'LEFT JOIN') {
            // LEFT JOIN
            joinedRows = this.leftJoin(table1.rows, table2.rows, col1Name, col2Name, table1Name, table2Name);
        } else if (joinType === 'RIGHT JOIN') {
            // RIGHT JOIN
            joinedRows = this.rightJoin(table1.rows, table2.rows, col1Name, col2Name, table1Name, table2Name);
        }

        // WHERE句の処理
        if (whereClause) {
            joinedRows = this.filterRows(joinedRows, whereClause);
        }

        // 列の選択
        let columns;
        let resultRows;

        if (columnsStr === '*') {
            // 全列を選択（重複する列名にはテーブル名を付与）
            const allColumns = new Set();
            const columnMapping = [];

            for (const col of table1.columns) {
                const colName = `${table1Name}.${col.name}`;
                allColumns.add(colName);
                columnMapping.push({ display: colName, key: `${table1Name}.${col.name}` });
            }

            for (const col of table2.columns) {
                const colName = `${table2Name}.${col.name}`;
                allColumns.add(colName);
                columnMapping.push({ display: colName, key: `${table2Name}.${col.name}` });
            }

            columns = columnMapping.map(c => c.display);
            resultRows = joinedRows.map(row => columnMapping.map(c => row[c.key] || ''));
        } else {
            // 指定された列を選択
            columns = columnsStr.split(',').map(col => col.trim());
            resultRows = joinedRows.map(row => {
                return columns.map(col => {
                    // テーブル名.列名 または 列名 の形式に対応
                    if (col.includes('.')) {
                        return row[col] || '';
                    } else {
                        // テーブル名なしの場合、両方のテーブルから検索
                        return row[`${table1Name}.${col}`] || row[`${table2Name}.${col}`] || '';
                    }
                });
            });
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

    // INNER JOIN
    innerJoin(rows1, rows2, col1, col2, table1Name, table2Name) {
        const result = [];

        for (const row1 of rows1) {
            for (const row2 of rows2) {
                if (row1[col1] && row2[col2] && row1[col1] === row2[col2]) {
                    const joinedRow = {};

                    // table1の列を追加（テーブル名.列名の形式）
                    for (const key in row1) {
                        joinedRow[`${table1Name}.${key}`] = row1[key];
                    }

                    // table2の列を追加（テーブル名.列名の形式）
                    for (const key in row2) {
                        joinedRow[`${table2Name}.${key}`] = row2[key];
                    }

                    result.push(joinedRow);
                }
            }
        }

        return result;
    }

    // LEFT JOIN
    leftJoin(rows1, rows2, col1, col2, table1Name, table2Name) {
        const result = [];

        for (const row1 of rows1) {
            let matched = false;

            for (const row2 of rows2) {
                if (row1[col1] && row2[col2] && row1[col1] === row2[col2]) {
                    const joinedRow = {};

                    // table1の列を追加
                    for (const key in row1) {
                        joinedRow[`${table1Name}.${key}`] = row1[key];
                    }

                    // table2の列を追加
                    for (const key in row2) {
                        joinedRow[`${table2Name}.${key}`] = row2[key];
                    }

                    result.push(joinedRow);
                    matched = true;
                }
            }

            // マッチしなかった場合、table2の列はNULL（空文字列）
            if (!matched) {
                const joinedRow = {};

                // table1の列を追加
                for (const key in row1) {
                    joinedRow[`${table1Name}.${key}`] = row1[key];
                }

                // table2の列は空
                if (rows2.length > 0) {
                    for (const key in rows2[0]) {
                        joinedRow[`${table2Name}.${key}`] = '';
                    }
                }

                result.push(joinedRow);
            }
        }

        return result;
    }

    // RIGHT JOIN
    rightJoin(rows1, rows2, col1, col2, table1Name, table2Name) {
        const result = [];

        for (const row2 of rows2) {
            let matched = false;

            for (const row1 of rows1) {
                if (row1[col1] && row2[col2] && row1[col1] === row2[col2]) {
                    const joinedRow = {};

                    // table1の列を追加
                    for (const key in row1) {
                        joinedRow[`${table1Name}.${key}`] = row1[key];
                    }

                    // table2の列を追加
                    for (const key in row2) {
                        joinedRow[`${table2Name}.${key}`] = row2[key];
                    }

                    result.push(joinedRow);
                    matched = true;
                }
            }

            // マッチしなかった場合、table1の列はNULL（空文字列）
            if (!matched) {
                const joinedRow = {};

                // table1の列は空
                if (rows1.length > 0) {
                    for (const key in rows1[0]) {
                        joinedRow[`${table1Name}.${key}`] = '';
                    }
                }

                // table2の列を追加
                for (const key in row2) {
                    joinedRow[`${table2Name}.${key}`] = row2[key];
                }

                result.push(joinedRow);
            }
        }

        return result;
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
