// sql-engine.js
// SQLコマンドのパース・実行エンジン

class SQLEngine {
    constructor() {
        this.tables = {};
    }

    // ダブルクォートやシングルクォートを除去
    removeQuotes(str) {
        if (!str) return str;
        return str.replace(/^["']|["']$/g, '');
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
                dataType: col.dataType || 'VARCHAR',
                foreignKey: col.foreignKey || null // 外部キー情報を取り込む
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
                    dataType: col.dataType,
                    foreignKey: col.foreignKey || null // 外部キー情報を渡す
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
        const rows = table.columns.map(col => {
            let keyInfo = '';
            if (col.isPrimaryKey) {
                keyInfo = 'PRI';
            } else if (col.foreignKey) {
                keyInfo = 'FK';
            }

            let foreignKeyInfo = '';
            if (col.foreignKey) {
                foreignKeyInfo = `${col.foreignKey.refTable}(${col.foreignKey.refColumn})`;
            }

            return [
                col.name,
                col.dataType,
                keyInfo,
                foreignKeyInfo
            ];
        });

        return {
            success: true,
            table: {
                columns: ['列名', 'データ型', 'キー', '参照先'],
                rows: rows
            }
        };
    }

    // SELECT文の実行
    executeSelect(sql) {
        // JOINを含むかチェック（複数JOIN対応）
        // 単語境界を使用して、前後がスペースでも改行でもマッチするようにする
        if (/\bJOIN\b/i.test(sql)) {
            return this.executeSelectWithMultiJoin(sql);
        }

        // 通常のSELECT文（スペースを含むテーブル名、改行に対応）
        // SELECT句とFROM句を抽出（[\s\S]で改行にも対応）
        const selectFromMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+([\s\S]+)$/i);

        if (!selectFromMatch) {
            throw new Error('構文エラー: SELECT 列名 FROM テーブル名 [WHERE 条件]');
        }

        let columnsStr = selectFromMatch[1].trim();
        const fromClause = selectFromMatch[2].trim();

        // DISTINCTキーワードを検出
        let isDistinct = false;
        if (/^DISTINCT\s+/i.test(columnsStr)) {
            isDistinct = true;
            columnsStr = columnsStr.replace(/^DISTINCT\s+/i, '').trim();
        }

        // FROM句以降をキーワードで分割（WHERE、GROUP BY、ORDER BY、LIMITの最初に出現するものを探す）
        let tableName = fromClause;
        let restClause = null;

        // WHERE句の位置を探す
        const wherePos = fromClause.search(/\s+WHERE\s+/i);
        // GROUP BY句の位置を探す
        const groupByPos = fromClause.search(/\s+GROUP\s+BY\s+/i);
        // ORDER BY句の位置を探す
        const orderByPos = fromClause.search(/\s+ORDER\s+BY\s+/i);
        // LIMIT句の位置を探す
        const limitPos = fromClause.search(/\s+LIMIT\s+/i);

        // 最初に出現するキーワードの位置を特定
        const positions = [
            { pos: wherePos, keyword: 'WHERE' },
            { pos: groupByPos, keyword: 'GROUP BY' },
            { pos: orderByPos, keyword: 'ORDER BY' },
            { pos: limitPos, keyword: 'LIMIT' }
        ].filter(p => p.pos !== -1).sort((a, b) => a.pos - b.pos);

        if (positions.length > 0) {
            const firstKeyword = positions[0];
            tableName = fromClause.substring(0, firstKeyword.pos).trim();
            restClause = fromClause.substring(firstKeyword.pos).trim();
        }

        // WHERE句、GROUP BY句、ORDER BY句、LIMIT句を順次抽出
        let whereClause = null;
        let groupByColumns = [];
        let hasGroupBy = false;
        let orderByColumn = null;
        let orderByDirection = 'ASC';
        let limitCount = null;

        // WHERE句の抽出
        const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+(?:GROUP\s+BY|ORDER\s+BY|LIMIT)|$)/i);
        if (whereMatch) {
            whereClause = whereMatch[1].trim();
        }

        // GROUP BY句の抽出
        const groupByMatch = sql.match(/GROUP\s+BY\s+([\s\S]+?)(?:\s+(?:ORDER\s+BY|LIMIT)|$)/i);
        if (groupByMatch) {
            hasGroupBy = true;
            groupByColumns = groupByMatch[1].split(',').map(col => col.trim());
        }

        // ORDER BY句の抽出
        const orderByMatch = sql.match(/ORDER\s+BY\s+(\S+)(?:\s+(ASC|DESC))?(?:\s+|$)/i);
        if (orderByMatch) {
            orderByColumn = orderByMatch[1].trim();
            orderByDirection = orderByMatch[2] ? orderByMatch[2].toUpperCase() : 'ASC';
        }

        // LIMIT句の抽出
        const limitMatch = sql.match(/LIMIT\s+(\d+)$/i);
        if (limitMatch) {
            limitCount = parseInt(limitMatch[1], 10);
        }

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
        } else if (hasGroupBy) {
            // GROUP BYがある場合の処理
            const selectedCols = columnsStr.split(',').map(col => col.trim());
            columns = [];
            const groupByCols = [];
            const aggregateFuncs = [];

            // SELECT句を解析（通常の列と集計関数を分離）
            for (const colExpr of selectedCols) {
                const asMatch = colExpr.match(/(.+?)\s+AS\s+(.+)/i);
                let expr, displayName;

                if (asMatch) {
                    expr = asMatch[1].trim();
                    displayName = this.removeQuotes(asMatch[2].trim());
                } else {
                    expr = colExpr;
                    displayName = colExpr;
                }

                // COUNT(*)を検出
                if (/COUNT\s*\(\s*\*\s*\)/i.test(expr)) {
                    columns.push(displayName);
                    aggregateFuncs.push({ type: 'count', displayName: displayName });
                } else {
                    // 通常の列（GROUP BY列）
                    columns.push(displayName);
                    groupByCols.push({ displayName: displayName, key: expr });
                }
            }

            // グループ化処理
            const groups = {};
            for (const row of rows) {
                // グループキーを生成
                const groupKey = groupByColumns.map(key => row[key] || '').join('||');

                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        rows: [],
                        groupValues: groupByColumns.map(key => row[key] || '')
                    };
                }
                groups[groupKey].rows.push(row);
            }

            // 集計結果を構築
            resultRows = [];
            for (const groupKey in groups) {
                const group = groups[groupKey];
                const resultRow = [];

                // 通常の列（GROUP BY列）の値を追加
                for (const col of groupByCols) {
                    resultRow.push(group.rows[0][col.key] || '');
                }

                // 集計関数の結果を追加
                for (const agg of aggregateFuncs) {
                    if (agg.type === 'count') {
                        resultRow.push(group.rows.length.toString());
                    }
                }

                resultRows.push(resultRow);
            }
        } else {
            // COUNT(*)が含まれているかチェック
            let hasCount = false;
            const selectedCols = columnsStr.split(',').map(col => col.trim());

            for (const colExpr of selectedCols) {
                if (/COUNT\s*\(\s*\*\s*\)/i.test(colExpr)) {
                    hasCount = true;
                    break;
                }
            }

            // COUNT(*)が含まれている場合は集計処理（GROUP BYなし）
            if (hasCount) {
                columns = [];
                const columnResolvers = [];

                for (const colExpr of selectedCols) {
                    const asMatch = colExpr.match(/(.+?)\s+AS\s+(.+)/i);
                    let displayName;

                    if (asMatch) {
                        displayName = this.removeQuotes(asMatch[2].trim());
                    } else {
                        displayName = colExpr;
                    }

                    if (/COUNT\s*\(\s*\*\s*\)/i.test(colExpr)) {
                        columns.push(displayName);
                        columnResolvers.push({ type: 'count' });
                    } else {
                        columns.push(displayName);
                        columnResolvers.push({ type: 'unsupported' });
                    }
                }

                // 結果は1行のみ（集計結果）
                const resultRow = columnResolvers.map(resolver => {
                    if (resolver.type === 'count') {
                        return rows.length.toString();
                    } else {
                        return '(未対応)';
                    }
                });
                resultRows = [resultRow];
            } else {
                // 通常の列選択処理
                columns = selectedCols;

                // 列が存在するか確認
                for (const col of columns) {
                    if (!table.columns.find(c => c.name === col)) {
                        throw new Error(`列 '${col}' が存在しません`);
                    }
                }

                resultRows = rows.map(row => columns.map(col => row[col] || ''));
            }
        }

        // DISTINCT処理（重複行の削除）
        if (isDistinct) {
            const uniqueRows = [];
            const seen = new Set();

            for (const row of resultRows) {
                // 行を文字列化してキーとする
                const rowKey = JSON.stringify(row);
                if (!seen.has(rowKey)) {
                    seen.add(rowKey);
                    uniqueRows.push(row);
                }
            }

            resultRows = uniqueRows;
        }

        // ORDER BY句の処理
        if (orderByColumn) {
            const orderByIndex = columns.findIndex(col => col === orderByColumn);

            if (orderByIndex !== -1) {
                resultRows.sort((a, b) => {
                    const aVal = a[orderByIndex];
                    const bVal = b[orderByIndex];

                    // 日付として解釈できる場合は日付比較（YYYY-MM-DD形式）
                    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                    if (datePattern.test(aVal) && datePattern.test(bVal)) {
                        const aDate = new Date(aVal);
                        const bDate = new Date(bVal);
                        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                            return orderByDirection === 'DESC' ? bDate - aDate : aDate - bDate;
                        }
                    }

                    // 数値として解釈できる場合は数値比較
                    const aNum = parseFloat(aVal);
                    const bNum = parseFloat(bVal);

                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return orderByDirection === 'DESC' ? bNum - aNum : aNum - bNum;
                    }

                    // 文字列比較
                    if (orderByDirection === 'DESC') {
                        return bVal.localeCompare(aVal);
                    } else {
                        return aVal.localeCompare(bVal);
                    }
                });
            }
        }

        // LIMIT句の適用
        const totalRows = resultRows.length;
        if (limitCount !== null && limitCount >= 0) {
            resultRows = resultRows.slice(0, limitCount);
        }

        // メッセージの生成
        let message = `${totalRows}件のレコードが見つかりました`;
        if (limitCount !== null && limitCount < totalRows) {
            message += ` (LIMIT ${limitCount}件を表示)`;
        }

        return {
            success: true,
            table: {
                columns: columns,
                rows: resultRows
            },
            message: message
        };
    }

    // 複数テーブルJOIN対応のSELECT実行
    executeSelectWithMultiJoin(sql) {
        // FROM句とJOIN句を抽出
        const fromMatch = sql.match(/FROM\s+("[^"]+"|\S+)(?:\s+(?:AS\s+)?(\w+))?/i);
        if (!fromMatch) {
            throw new Error('FROM句が見つかりません');
        }

        let baseTableName = this.removeQuotes(fromMatch[1].trim());
        const baseTableAlias = fromMatch[2] ? fromMatch[2].trim() : null;

        // エイリアスマッピング
        const aliasMap = {};
        if (baseTableAlias) {
            aliasMap[baseTableAlias] = baseTableName;
        }

        // テーブルの存在確認
        if (!this.tables[baseTableName]) {
            throw new Error(`テーブル '${baseTableName}' が存在しません`);
        }

        // 全てのJOIN句を抽出
        const joinPattern = /((?:INNER\s+|LEFT\s+|RIGHT\s+)?JOIN)\s+("[^"]+"|\S+)(?:\s+(?:AS\s+)?(\w+))?\s+ON\s+(\S+)\s*=\s*(\S+)/gi;
        const joins = [];
        let match;

        while ((match = joinPattern.exec(sql)) !== null) {
            const joinType = match[1].trim().toUpperCase();
            const tableName = this.removeQuotes(match[2].trim());
            const tableAlias = match[3] ? match[3].trim() : null;
            const leftCol = match[4].trim();
            const rightCol = match[5].trim();

            if (tableAlias) {
                aliasMap[tableAlias] = tableName;
            }

            if (!this.tables[tableName]) {
                throw new Error(`テーブル '${tableName}' が存在しません`);
            }

            joins.push({
                type: joinType,
                tableName: tableName,
                alias: tableAlias,
                leftCol: leftCol,
                rightCol: rightCol
            });
        }

        // SELECT句を抽出（改行対応）
        const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
        if (!selectMatch) {
            throw new Error('SELECT句が見つかりません');
        }
        let columnsStr = selectMatch[1].trim();

        // DISTINCTキーワードを検出
        let isDistinct = false;
        if (/^DISTINCT\s+/i.test(columnsStr)) {
            isDistinct = true;
            columnsStr = columnsStr.replace(/^DISTINCT\s+/i, '').trim();
        }

        // ベーステーブルから開始
        let resultRows = this.tables[baseTableName].rows.map(row => {
            const newRow = {};
            for (const key in row) {
                newRow[`${baseTableName}.${key}`] = row[key];
            }
            return newRow;
        });

        // 全てのテーブル情報を保持
        const allTables = [{ name: baseTableName, alias: baseTableAlias }];

        // 各JOIN句を順次適用
        for (const join of joins) {
            const joinTable = this.tables[join.tableName];

            // 結合列名を解析
            const leftParts = join.leftCol.split('.');
            let leftColName;
            if (leftParts.length > 1) {
                const prefix = leftParts[0];
                leftColName = this.removeQuotes(leftParts[1]);
                const actualTableName = aliasMap[prefix] || this.removeQuotes(prefix);
                leftColName = `${actualTableName}.${leftColName}`;
            } else {
                leftColName = this.removeQuotes(leftParts[0]);
            }

            const rightParts = join.rightCol.split('.');
            let rightColName;
            if (rightParts.length > 1) {
                const prefix = rightParts[0];
                rightColName = this.removeQuotes(rightParts[1]);
            } else {
                rightColName = this.removeQuotes(rightParts[0]);
            }

            // JOINを実行
            const newResultRows = [];

            if (join.type === 'JOIN' || join.type === 'INNER JOIN') {
                // INNER JOIN
                for (const leftRow of resultRows) {
                    for (const rightRow of joinTable.rows) {
                        if (leftRow[leftColName] && rightRow[rightColName] &&
                            leftRow[leftColName] === rightRow[rightColName]) {
                            const joinedRow = { ...leftRow };
                            for (const key in rightRow) {
                                joinedRow[`${join.tableName}.${key}`] = rightRow[key];
                            }
                            newResultRows.push(joinedRow);
                        }
                    }
                }
            } else if (join.type === 'LEFT JOIN') {
                // LEFT JOIN
                for (const leftRow of resultRows) {
                    let matched = false;
                    for (const rightRow of joinTable.rows) {
                        if (leftRow[leftColName] && rightRow[rightColName] &&
                            leftRow[leftColName] === rightRow[rightColName]) {
                            const joinedRow = { ...leftRow };
                            for (const key in rightRow) {
                                joinedRow[`${join.tableName}.${key}`] = rightRow[key];
                            }
                            newResultRows.push(joinedRow);
                            matched = true;
                        }
                    }
                    if (!matched) {
                        const joinedRow = { ...leftRow };
                        for (const col of joinTable.columns) {
                            joinedRow[`${join.tableName}.${col.name}`] = '';
                        }
                        newResultRows.push(joinedRow);
                    }
                }
            }

            resultRows = newResultRows;
            allTables.push({ name: join.tableName, alias: join.alias });
        }

        // WHERE句の処理（改行対応）
        const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+(?:GROUP|ORDER)|$)/i);
        if (whereMatch) {
            let whereClause = whereMatch[1].trim();

            // エイリアスを実際のテーブル名に置換
            for (const [alias, tableName] of Object.entries(aliasMap)) {
                // エイリアス.列名 を テーブル名.列名 に置換
                const aliasPattern = new RegExp(`\\b${alias}\\.`, 'g');
                whereClause = whereClause.replace(aliasPattern, `${tableName}.`);
            }

            resultRows = this.filterRows(resultRows, whereClause);
        }

        // GROUP BY句の抽出（改行対応）
        const groupByMatch = sql.match(/GROUP\s+BY\s+([\s\S]+?)(?:\s+(?:ORDER|HAVING|$))/i);
        const hasGroupBy = !!groupByMatch;
        let groupByColumns = [];

        if (hasGroupBy) {
            groupByColumns = groupByMatch[1].split(',').map(col => col.trim());
        }

        // ORDER BY句の抽出（改行対応）
        const orderByMatch = sql.match(/ORDER\s+BY\s+([\s\S]+?)$/i);
        let orderByColumn = null;
        let orderByDirection = 'ASC';

        if (orderByMatch) {
            const orderByClause = orderByMatch[1].trim();
            const orderParts = orderByClause.split(/\s+/);
            orderByColumn = this.removeQuotes(orderParts[0]);
            if (orderParts[1] && orderParts[1].toUpperCase() === 'DESC') {
                orderByDirection = 'DESC';
            }
        }

        // 列の選択
        let columns;
        let finalRows;

        if (columnsStr === '*') {
            // 全列を選択
            const columnMapping = [];
            for (const tableInfo of allTables) {
                const table = this.tables[tableInfo.name];
                for (const col of table.columns) {
                    const colName = `${tableInfo.name}.${col.name}`;
                    columnMapping.push({ display: colName, key: colName });
                }
            }

            columns = columnMapping.map(c => c.display);
            finalRows = resultRows.map(row => columnMapping.map(c => row[c.key] || ''));
        } else if (hasGroupBy) {
            // GROUP BYがある場合の処理
            const selectedCols = columnsStr.split(',').map(col => col.trim());
            columns = [];
            const groupByCols = [];
            const aggregateFuncs = [];

            // SELECT句を解析（通常の列と集計関数を分離）
            for (const colExpr of selectedCols) {
                const asMatch = colExpr.match(/(.+?)\s+AS\s+(.+)/i);
                let expr, displayName;

                if (asMatch) {
                    expr = asMatch[1].trim();
                    displayName = this.removeQuotes(asMatch[2].trim());
                } else {
                    expr = colExpr;
                    displayName = colExpr;
                }

                // COUNT(*)を検出
                if (/COUNT\s*\(\s*\*\s*\)/i.test(expr)) {
                    columns.push(displayName);
                    aggregateFuncs.push({ type: 'count', displayName: displayName });
                } else {
                    // 通常の列
                    if (expr.includes('.')) {
                        const parts = expr.split('.');
                        const prefix = parts[0];
                        const colName = this.removeQuotes(parts[1]);
                        const actualTableName = aliasMap[prefix] || this.removeQuotes(prefix);
                        const fullColName = `${actualTableName}.${colName}`;

                        columns.push(displayName);
                        groupByCols.push({ displayName: displayName, key: fullColName });
                    } else {
                        const cleanColName = this.removeQuotes(expr);
                        const keys = allTables.map(t => `${t.name}.${cleanColName}`);

                        columns.push(displayName);
                        groupByCols.push({ displayName: displayName, keys: keys });
                    }
                }
            }

            // GROUP BY列を解決
            const resolvedGroupByKeys = [];
            for (const groupByCol of groupByColumns) {
                if (groupByCol.includes('.')) {
                    const parts = groupByCol.split('.');
                    const prefix = parts[0];
                    const colName = this.removeQuotes(parts[1]);
                    const actualTableName = aliasMap[prefix] || this.removeQuotes(prefix);
                    resolvedGroupByKeys.push(`${actualTableName}.${colName}`);
                } else {
                    const cleanColName = this.removeQuotes(groupByCol);
                    // 最初に見つかった列を使用
                    for (const t of allTables) {
                        const key = `${t.name}.${cleanColName}`;
                        if (resultRows.length > 0 && resultRows[0].hasOwnProperty(key)) {
                            resolvedGroupByKeys.push(key);
                            break;
                        }
                    }
                }
            }

            // グループ化処理
            const groups = {};
            for (const row of resultRows) {
                // グループキーを生成
                const groupKey = resolvedGroupByKeys.map(key => row[key] || '').join('||');

                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        rows: [],
                        groupValues: resolvedGroupByKeys.map(key => row[key] || '')
                    };
                }
                groups[groupKey].rows.push(row);
            }

            // 集計結果を構築
            finalRows = [];
            for (const groupKey in groups) {
                const group = groups[groupKey];
                const resultRow = [];

                // 通常の列（GROUP BY列）の値を追加
                for (const col of groupByCols) {
                    if (col.key) {
                        resultRow.push(group.rows[0][col.key] || '');
                    } else if (col.keys) {
                        resultRow.push(col.keys.map(k => group.rows[0][k]).find(v => v) || '');
                    }
                }

                // 集計関数の結果を追加
                for (const agg of aggregateFuncs) {
                    if (agg.type === 'count') {
                        resultRow.push(group.rows.length.toString());
                    }
                }

                finalRows.push(resultRow);
            }
        } else {
            // GROUP BYがない場合の通常の処理
            const selectedCols = columnsStr.split(',').map(col => col.trim());
            columns = [];
            const columnResolvers = [];

            // COUNT(*)が含まれているかチェック
            let hasCount = false;
            for (const colExpr of selectedCols) {
                if (/COUNT\s*\(\s*\*\s*\)/i.test(colExpr)) {
                    hasCount = true;
                    break;
                }
            }

            // COUNT(*)が含まれている場合は集計処理
            if (hasCount) {
                for (const colExpr of selectedCols) {
                    const asMatch = colExpr.match(/(.+?)\s+AS\s+(.+)/i);
                    let displayName;

                    if (asMatch) {
                        displayName = this.removeQuotes(asMatch[2].trim());
                    } else {
                        displayName = colExpr;
                    }

                    if (/COUNT\s*\(\s*\*\s*\)/i.test(colExpr)) {
                        columns.push(displayName);
                        columnResolvers.push({ type: 'count' });
                    } else {
                        columns.push(displayName);
                        columnResolvers.push({ type: 'unsupported' });
                    }
                }

                // 結果は1行のみ（集計結果）
                const resultRow = columnResolvers.map(resolver => {
                    if (resolver.type === 'count') {
                        return resultRows.length.toString();
                    } else {
                        return '(未対応)';
                    }
                });
                finalRows = [resultRow];
            } else {
                // 通常の列選択処理
                for (const colExpr of selectedCols) {
                    // AS句の処理
                    const asMatch = colExpr.match(/(.+?)\s+AS\s+(.+)/i);
                    let displayName, colKey;

                    if (asMatch) {
                        const expr = asMatch[1].trim();
                        displayName = this.removeQuotes(asMatch[2].trim());

                        if (expr.includes('(')) {
                            columns.push(displayName);
                            columnResolvers.push({ type: 'unsupported' });
                            continue;
                        }

                        colKey = expr;
                    } else {
                        displayName = colExpr;
                        colKey = colExpr;
                    }

                // 列名を解決
                if (colKey.includes('.')) {
                    const parts = colKey.split('.');
                    const prefix = parts[0];
                    const colName = this.removeQuotes(parts[1]);
                    const actualTableName = aliasMap[prefix] || this.removeQuotes(prefix);
                    const fullColName = `${actualTableName}.${colName}`;

                    columns.push(displayName);
                    columnResolvers.push({ type: 'qualified', key: fullColName });
                } else {
                    // テーブル名なしの場合、全テーブルから検索
                    const cleanColName = this.removeQuotes(colKey);
                    const keys = allTables.map(t => `${t.name}.${cleanColName}`);

                    columns.push(displayName);
                    columnResolvers.push({ type: 'unqualified', keys: keys });
                }
                }

                finalRows = resultRows.map(row => {
                    return columnResolvers.map(resolver => {
                        if (resolver.type === 'unsupported') {
                            return '(未対応)';
                        } else if (resolver.type === 'qualified') {
                            return row[resolver.key] || '';
                        } else if (resolver.type === 'unqualified') {
                            return resolver.keys.map(k => row[k]).find(v => v) || '';
                        }
                        return '';
                    });
                });
            }
        }

        // DISTINCT処理（重複行の削除）
        if (isDistinct) {
            const uniqueRows = [];
            const seen = new Set();

            for (const row of finalRows) {
                // 行を文字列化してキーとする
                const rowKey = JSON.stringify(row);
                if (!seen.has(rowKey)) {
                    seen.add(rowKey);
                    uniqueRows.push(row);
                }
            }

            finalRows = uniqueRows;
        }

        // ORDER BY処理
        if (orderByColumn) {
            const orderByIndex = columns.findIndex(col => {
                // 列名が完全一致するか、クォートを除去して一致するかチェック
                return col === orderByColumn || this.removeQuotes(col) === orderByColumn;
            });

            if (orderByIndex !== -1) {
                finalRows.sort((a, b) => {
                    const aVal = a[orderByIndex];
                    const bVal = b[orderByIndex];

                    // 日付として解釈できる場合は日付比較（YYYY-MM-DD形式）
                    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                    if (datePattern.test(aVal) && datePattern.test(bVal)) {
                        const aDate = new Date(aVal);
                        const bDate = new Date(bVal);
                        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                            return orderByDirection === 'DESC' ? bDate - aDate : aDate - bDate;
                        }
                    }

                    // 数値として解釈できる場合は数値比較
                    const aNum = parseFloat(aVal);
                    const bNum = parseFloat(bVal);

                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return orderByDirection === 'DESC' ? bNum - aNum : aNum - bNum;
                    }

                    // 文字列比較
                    if (orderByDirection === 'DESC') {
                        return bVal.localeCompare(aVal);
                    } else {
                        return aVal.localeCompare(bVal);
                    }
                });
            }
        }

        // LIMIT句の抽出と適用
        const limitMatch = sql.match(/LIMIT\s+(\d+)$/i);
        const totalRows = finalRows.length;
        if (limitMatch) {
            const limitCount = parseInt(limitMatch[1], 10);
            if (limitCount >= 0) {
                finalRows = finalRows.slice(0, limitCount);
            }
        }

        // メッセージの生成
        let message = `${totalRows}件のレコードが見つかりました`;
        if (limitMatch) {
            const limitCount = parseInt(limitMatch[1], 10);
            if (limitCount < totalRows) {
                message += ` (LIMIT ${limitCount}件を表示)`;
            }
        }

        return {
            success: true,
            table: {
                columns: columns,
                rows: finalRows
            },
            message: message
        };
    }

    // JOIN付きSELECT文の実行
    executeSelectWithJoin(sql, joinMatch) {
        const columnsStr = joinMatch[1].trim();
        let table1Name = this.removeQuotes(joinMatch[2].trim());
        const table1Alias = joinMatch[3] ? joinMatch[3].trim() : null;
        const joinType = joinMatch[4].trim().toUpperCase();
        let table2Name = this.removeQuotes(joinMatch[5].trim());
        const table2Alias = joinMatch[6] ? joinMatch[6].trim() : null;
        const joinCol1 = joinMatch[7].trim();
        const joinCol2 = joinMatch[8].trim();
        const restClause = joinMatch[9] ? joinMatch[9].trim() : null;

        // エイリアスマッピング（エイリアス → 実際のテーブル名）
        const aliasMap = {};
        if (table1Alias) {
            aliasMap[table1Alias] = table1Name;
        }
        if (table2Alias) {
            aliasMap[table2Alias] = table2Name;
        }

        // テーブルの存在確認
        if (!this.tables[table1Name]) {
            throw new Error(`テーブル '${table1Name}' が存在しません`);
        }
        if (!this.tables[table2Name]) {
            throw new Error(`テーブル '${table2Name}' が存在しません`);
        }

        const table1 = this.tables[table1Name];
        const table2 = this.tables[table2Name];

        // 結合列名を解析（エイリアス.列名 または テーブル名.列名 の形式に対応）
        const col1Parts = joinCol1.split('.');
        let col1Name;
        let col1TableName = table1Name;

        if (col1Parts.length > 1) {
            const prefix = col1Parts[0];
            col1Name = this.removeQuotes(col1Parts[1]);
            // エイリアスまたはテーブル名
            col1TableName = aliasMap[prefix] || this.removeQuotes(prefix);
        } else {
            col1Name = this.removeQuotes(col1Parts[0]);
        }

        const col2Parts = joinCol2.split('.');
        let col2Name;
        let col2TableName = table2Name;

        if (col2Parts.length > 1) {
            const prefix = col2Parts[0];
            col2Name = this.removeQuotes(col2Parts[1]);
            // エイリアスまたはテーブル名
            col2TableName = aliasMap[prefix] || this.removeQuotes(prefix);
        } else {
            col2Name = this.removeQuotes(col2Parts[0]);
        }

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

        // WHERE句の抽出と処理（GROUP BY、ORDER BYは現時点では無視）
        let whereClause = null;
        if (restClause) {
            const whereMatch = restClause.match(/WHERE\s+(.+?)(?:\s+(?:GROUP|ORDER)|$)/i);
            if (whereMatch) {
                whereClause = whereMatch[1].trim();
            }
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
            // 指定された列を選択（エイリアス対応）
            const selectedCols = columnsStr.split(',').map(col => col.trim());

            // 最初に列情報を解析してcolumns配列を構築
            columns = [];
            const columnResolvers = [];

            for (const colExpr of selectedCols) {
                // AS句で列エイリアスが指定されている場合（例: COUNT(*) AS "貸出冊数"）
                const asMatch = colExpr.match(/(.+?)\s+AS\s+(.+)/i);
                let displayName, colKey;

                if (asMatch) {
                    const expr = asMatch[1].trim();
                    displayName = this.removeQuotes(asMatch[2].trim());

                    // 集約関数の場合は現時点では未対応
                    if (expr.includes('(')) {
                        columns.push(displayName);
                        columnResolvers.push({ type: 'unsupported' });
                        continue;
                    }

                    colKey = expr;
                } else {
                    displayName = colExpr;
                    colKey = colExpr;
                }

                // 列名を解決（エイリアス.列名 または テーブル名.列名 または 列名）
                if (colKey.includes('.')) {
                    const parts = colKey.split('.');
                    const prefix = parts[0];
                    const colName = this.removeQuotes(parts[1]);

                    // エイリアスを実際のテーブル名に変換
                    const actualTableName = aliasMap[prefix] || this.removeQuotes(prefix);
                    const fullColName = `${actualTableName}.${colName}`;

                    columns.push(displayName);
                    columnResolvers.push({ type: 'qualified', key: fullColName });
                } else {
                    // テーブル名なしの場合、両方のテーブルから検索
                    const cleanColName = this.removeQuotes(colKey);
                    columns.push(displayName);
                    columnResolvers.push({
                        type: 'unqualified',
                        keys: [`${table1Name}.${cleanColName}`, `${table2Name}.${cleanColName}`]
                    });
                }
            }

            // 実際のデータ行を構築
            resultRows = joinedRows.map(row => {
                return columnResolvers.map(resolver => {
                    if (resolver.type === 'unsupported') {
                        return '(未対応)';
                    } else if (resolver.type === 'qualified') {
                        return row[resolver.key] || '';
                    } else if (resolver.type === 'unqualified') {
                        return resolver.keys.map(k => row[k]).find(v => v) || '';
                    }
                    return '';
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
        // LIKE句のパターン: 列名 LIKE 'パターン' （テーブル名.列名 にも対応）
        const likeMatch = whereClause.match(/([^\s]+)\s+LIKE\s+'([^']+)'/i);
        if (likeMatch) {
            const column = likeMatch[1];
            const pattern = likeMatch[2];

            // SQLのLIKEパターンを正規表現に変換
            // % -> .* (0文字以上の任意の文字)
            // _ -> . (1文字の任意の文字)
            // その他の特殊文字はエスケープ
            const regexPattern = pattern
                .replace(/%/g, '<<<PERCENT>>>')  // %を一時プレースホルダーに
                .replace(/_/g, '<<<UNDERSCORE>>>')  // _を一時プレースホルダーに
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 正規表現の特殊文字をエスケープ
                .replace(/<<<PERCENT>>>/g, '.*')  // プレースホルダーを.*に
                .replace(/<<<UNDERSCORE>>>/g, '.'); // プレースホルダーを.に

            const regex = new RegExp(`^${regexPattern}$`, 'i'); // 大文字小文字を区別しない

            console.log('[LIKE Debug]', {
                column,
                pattern,
                regexPattern,
                regex: regex.toString(),
                rowCount: rows.length,
                sampleRow: rows[0]
            });

            const filtered = rows.filter(row => {
                const rowValue = row[column];
                if (!rowValue) return false;
                const matches = regex.test(rowValue.toString());
                console.log(`  Row value: "${rowValue}" -> ${matches}`);
                return matches;
            });

            console.log(`[LIKE Result] ${filtered.length} rows matched`);
            return filtered;
        }

        // IN句のパターン: 列名 IN ('値1', '値2', ...) （テーブル名.列名 にも対応）
        const inMatch = whereClause.match(/([^\s]+)\s+IN\s+\(([^)]+)\)/i);
        if (inMatch) {
            const column = inMatch[1];
            const valuesStr = inMatch[2];

            // カンマ区切りの値をパース（クォートを除去）
            const values = valuesStr.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));

            return rows.filter(row => {
                const rowValue = row[column];
                if (!rowValue) return false;

                // 値のリストに含まれるかチェック
                return values.includes(rowValue.toString());
            });
        }

        // BETWEEN句のパターン: 列名 BETWEEN '値1' AND '値2' （テーブル名.列名 にも対応）
        const betweenMatch = whereClause.match(/([^\s]+)\s+BETWEEN\s+'([^']+)'\s+AND\s+'([^']+)'/i);
        if (betweenMatch) {
            const column = betweenMatch[1];
            const value1 = betweenMatch[2];
            const value2 = betweenMatch[3];

            return rows.filter(row => {
                const rowValue = row[column];
                if (!rowValue) return false;

                // 日付形式の場合
                const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                if (datePattern.test(value1) && datePattern.test(value2) && datePattern.test(rowValue)) {
                    const rowDate = new Date(rowValue);
                    const date1 = new Date(value1);
                    const date2 = new Date(value2);
                    return rowDate >= date1 && rowDate <= date2;
                }

                // 数値の場合
                const rowNum = parseFloat(rowValue);
                const num1 = parseFloat(value1);
                const num2 = parseFloat(value2);
                if (!isNaN(rowNum) && !isNaN(num1) && !isNaN(num2)) {
                    return rowNum >= num1 && rowNum <= num2;
                }

                // 文字列比較
                return rowValue >= value1 && rowValue <= value2;
            });
        }

        // 簡易的な実装: 列名 = '値' または 列名 = 値 の形式 （テーブル名.列名 にも対応）
        const match = whereClause.match(/([^\s]+)\s*=\s*'?([^']+)'?/);

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
        // テーブル名を抽出
        const tableNameMatch = sql.match(/INSERT\s+INTO\s+(\S+)/i);

        if (!tableNameMatch) {
            throw new Error('構文エラー: INSERT INTO テーブル名 (列名1, 列名2, ...) VALUES (値1, 値2, ...)');
        }

        const tableName = tableNameMatch[1].trim();

        // 列名リストを抽出（最初の括弧）
        const firstOpenParen = sql.indexOf('(');
        const firstCloseParen = sql.indexOf(')', firstOpenParen);

        if (firstOpenParen === -1 || firstCloseParen === -1) {
            throw new Error('構文エラー: 列名リストが見つかりません');
        }

        const columnsStr = sql.substring(firstOpenParen + 1, firstCloseParen).trim();

        // VALUES句の位置を探す
        const valuesIndex = sql.toUpperCase().indexOf('VALUES');
        if (valuesIndex === -1) {
            throw new Error('構文エラー: VALUES句が見つかりません');
        }

        // VALUES後の括弧を抽出（最後の括弧ペア）
        const valuesStartParen = sql.indexOf('(', valuesIndex);
        const valuesEndParen = sql.lastIndexOf(')');

        if (valuesStartParen === -1 || valuesEndParen === -1 || valuesStartParen >= valuesEndParen) {
            throw new Error('構文エラー: VALUES句の値リストが見つかりません');
        }

        const valuesStr = sql.substring(valuesStartParen + 1, valuesEndParen).trim();

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
        // CREATE TABLE table_name (column1 type, column2 type PRIMARY KEY, column3 type REFERENCES ref_table(ref_col), FOREIGN KEY (col) REFERENCES ref_table(ref_col), ...)
        const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(\S+)/i);

        if (!tableNameMatch) {
            throw new Error('構文エラー: CREATE TABLE テーブル名 (列名1 型, 列名2 型 PRIMARY KEY, ...)');
        }

        const tableName = tableNameMatch[1].trim();

        // 括弧内の文字列を抽出（最初の ( から最後の ) まで）
        const startIdx = sql.indexOf('(');
        const endIdx = sql.lastIndexOf(')');

        if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
            throw new Error('構文エラー: CREATE TABLE テーブル名 (列名1 型, 列名2 型 PRIMARY KEY, ...)');
        }

        const columnsStr = sql.substring(startIdx + 1, endIdx).trim();

        if (this.tables[tableName]) {
            throw new Error(`テーブル '${tableName}' は既に存在します`);
        }

        // 列定義をパース
        const columnDefs = columnsStr.split(',').map(def => def.trim());
        const columns = [];
        const foreignKeys = [];

        for (const def of columnDefs) {
            // テーブル制約としてのFOREIGN KEYをチェック
            // 例: FOREIGN KEY (列名) REFERENCES 参照先テーブル(参照先列)
            const tableFkMatch = def.match(/FOREIGN\s+KEY\s*\(\s*(\w+)\s*\)\s+REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/i);
            if (tableFkMatch) {
                foreignKeys.push({
                    columnName: tableFkMatch[1],
                    refTable: tableFkMatch[2],
                    refColumn: tableFkMatch[3]
                });
                continue; // この行は列定義ではないのでスキップ
            }

            // 通常の列定義をパース
            const parts = def.split(/\s+/);
            const columnName = parts[0];
            const dataType = parts[1] || 'VARCHAR';
            const isPrimaryKey = def.toUpperCase().includes('PRIMARY KEY');

            // 列定義内のREFERENCESキーワードをチェック
            // 例: 列名 型 REFERENCES 参照先テーブル(参照先列)
            const columnFkMatch = def.match(/REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/i);
            let foreignKey = null;
            if (columnFkMatch) {
                foreignKey = {
                    refTable: columnFkMatch[1],
                    refColumn: columnFkMatch[2]
                };
            }

            columns.push({
                name: columnName,
                dataType: dataType,
                isPrimaryKey: isPrimaryKey,
                foreignKey: foreignKey // 外部キー情報（nullまたは{refTable, refColumn}）
            });
        }

        // テーブル制約として定義された外部キーを列に適用
        for (const fk of foreignKeys) {
            const column = columns.find(col => col.name === fk.columnName);
            if (column) {
                column.foreignKey = {
                    refTable: fk.refTable,
                    refColumn: fk.refColumn
                };
            }
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
