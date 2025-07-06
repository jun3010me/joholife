        // グローバル変数
        let tables = {};
        let tableData = {};
        let relations = [];
        let currentEditingTable = null;
        let draggedTable = null;
        let tablePositions = {};
        let savedDesigns = {};
        
        // 学習・テスト関連
        let currentMode = 'design';
        let learningProgress = {};
        let quizScores = {};
        let currentLesson = null;
        let currentLessonStep = 0;
        let currentQuiz = null;
        let currentQuizIndex = 0;
        let quizAnswers = [];
        let quizQuestions = [];

        // 初期化
        document.addEventListener('DOMContentLoaded', function() {
            loadFromStorage();
            if (Object.keys(tables).length === 0) {
                // 初回は学校管理システムのプリセットを読み込み
                loadPreset('school');
            }
        });

        // ローカルストレージから読み込み
        function loadFromStorage() {
            try {
                const savedTables = localStorage.getItem('dbTables');
                const savedData = localStorage.getItem('dbTableData');
                const savedRelations = localStorage.getItem('dbRelations');
                const savedPositions = localStorage.getItem('dbTablePositions');
                const savedDesignsData = localStorage.getItem('dbSavedDesigns');
                const savedLearningProgress = localStorage.getItem('dbLearningProgress');
                const savedQuizScores = localStorage.getItem('dbQuizScores');
                
                if (savedTables) tables = JSON.parse(savedTables);
                if (savedData) tableData = JSON.parse(savedData);
                if (savedRelations) relations = JSON.parse(savedRelations);
                if (savedPositions) tablePositions = JSON.parse(savedPositions);
                if (savedDesignsData) savedDesigns = JSON.parse(savedDesignsData);
                if (savedLearningProgress) learningProgress = JSON.parse(savedLearningProgress);
                if (savedQuizScores) quizScores = JSON.parse(savedQuizScores);
                
                updateDisplay();
                updateLearningProgress();
                updateQuizProgress();
            } catch (e) {
                console.error('ストレージからの読み込みに失敗しました:', e);
            }
        }

        // ローカルストレージに保存
        function saveToStorage() {
            try {
                localStorage.setItem('dbTables', JSON.stringify(tables));
                localStorage.setItem('dbTableData', JSON.stringify(tableData));
                localStorage.setItem('dbRelations', JSON.stringify(relations));
                localStorage.setItem('dbTablePositions', JSON.stringify(tablePositions));
                localStorage.setItem('dbSavedDesigns', JSON.stringify(savedDesigns));
                localStorage.setItem('dbLearningProgress', JSON.stringify(learningProgress));
                localStorage.setItem('dbQuizScores', JSON.stringify(quizScores));
            } catch (e) {
                console.error('ストレージへの保存に失敗しました:', e);
            }
        }

        // プリセット読み込み
        function loadPreset(presetType) {
            tables = {};
            tableData = {};
            tablePositions = {};
            
            switch(presetType) {
                case 'school':
                    loadSchoolPreset();
                    break;
                case 'library':
                    loadLibraryPreset();
                    break;
                case 'ecommerce':
                    loadEcommercePreset();
                    break;
                case 'club':
                    loadClubPreset();
                    break;
            }
            
            updateRelations();
            updateDisplay();
            generateERDiagram();
            saveToStorage();
        }

        function loadSchoolPreset() {
            tables = {
                'students': {
                    name: 'students',
                    displayName: '生徒',
                    fields: [
                        { name: 'student_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '生徒ID' },
                        { name: 'name', type: 'VARCHAR(50)', isPrimary: false, isRequired: true, displayName: '名前' },
                        { name: 'class_id', type: 'INT', isPrimary: false, isRequired: true, displayName: 'クラスID', isForeign: true, references: 'classes.class_id' },
                        { name: 'birth_date', type: 'DATE', isPrimary: false, isRequired: false, displayName: '生年月日' }
                    ]
                },
                'classes': {
                    name: 'classes',
                    displayName: 'クラス',
                    fields: [
                        { name: 'class_id', type: 'INT', isPrimary: true, isRequired: true, displayName: 'クラスID' },
                        { name: 'class_name', type: 'VARCHAR(20)', isPrimary: false, isRequired: true, displayName: 'クラス名' },
                        { name: 'grade', type: 'INT', isPrimary: false, isRequired: true, displayName: '学年' },
                        { name: 'teacher_name', type: 'VARCHAR(50)', isPrimary: false, isRequired: false, displayName: '担任' }
                    ]
                },
                'subjects': {
                    name: 'subjects',
                    displayName: '科目',
                    fields: [
                        { name: 'subject_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '科目ID' },
                        { name: 'subject_name', type: 'VARCHAR(30)', isPrimary: false, isRequired: true, displayName: '科目名' },
                        { name: 'credits', type: 'INT', isPrimary: false, isRequired: true, displayName: '単位数' }
                    ]
                }
            };
            
            
            tablePositions = {
                'students': { x: 50, y: 50 },
                'classes': { x: 300, y: 50 },
                'subjects': { x: 175, y: 200 }
            };
        }

        function loadLibraryPreset() {
            tables = {
                'books': {
                    name: 'books',
                    displayName: '書籍',
                    fields: [
                        { name: 'book_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '書籍ID' },
                        { name: 'title', type: 'VARCHAR(100)', isPrimary: false, isRequired: true, displayName: 'タイトル' },
                        { name: 'author', type: 'VARCHAR(50)', isPrimary: false, isRequired: true, displayName: '著者' },
                        { name: 'isbn', type: 'VARCHAR(20)', isPrimary: false, isRequired: false, displayName: 'ISBN' }
                    ]
                },
                'users': {
                    name: 'users',
                    displayName: '利用者',
                    fields: [
                        { name: 'user_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '利用者ID' },
                        { name: 'name', type: 'VARCHAR(50)', isPrimary: false, isRequired: true, displayName: '名前' },
                        { name: 'email', type: 'VARCHAR(100)', isPrimary: false, isRequired: false, displayName: 'メール' }
                    ]
                },
                'loans': {
                    name: 'loans',
                    displayName: '貸出',
                    fields: [
                        { name: 'loan_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '貸出ID' },
                        { name: 'book_id', type: 'INT', isPrimary: false, isRequired: true, displayName: '書籍ID', isForeign: true, references: 'books.book_id' },
                        { name: 'user_id', type: 'INT', isPrimary: false, isRequired: true, displayName: '利用者ID', isForeign: true, references: 'users.user_id' },
                        { name: 'loan_date', type: 'DATE', isPrimary: false, isRequired: true, displayName: '貸出日' },
                        { name: 'return_date', type: 'DATE', isPrimary: false, isRequired: false, displayName: '返却日' }
                    ]
                }
            };
            
            
            tablePositions = {
                'books': { x: 50, y: 50 },
                'users': { x: 350, y: 50 },
                'loans': { x: 200, y: 200 }
            };
        }

        function loadEcommercePreset() {
            tables = {
                'products': {
                    name: 'products',
                    displayName: '商品',
                    fields: [
                        { name: 'product_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '商品ID' },
                        { name: 'name', type: 'VARCHAR(100)', isPrimary: false, isRequired: true, displayName: '商品名' },
                        { name: 'price', type: 'DECIMAL(10,2)', isPrimary: false, isRequired: true, displayName: '価格' },
                        { name: 'stock', type: 'INT', isPrimary: false, isRequired: true, displayName: '在庫数' }
                    ]
                },
                'customers': {
                    name: 'customers',
                    displayName: '顧客',
                    fields: [
                        { name: 'customer_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '顧客ID' },
                        { name: 'name', type: 'VARCHAR(50)', isPrimary: false, isRequired: true, displayName: '名前' },
                        { name: 'email', type: 'VARCHAR(100)', isPrimary: false, isRequired: true, displayName: 'メール' },
                        { name: 'address', type: 'TEXT', isPrimary: false, isRequired: false, displayName: '住所' }
                    ]
                },
                'orders': {
                    name: 'orders',
                    displayName: '注文',
                    fields: [
                        { name: 'order_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '注文ID' },
                        { name: 'customer_id', type: 'INT', isPrimary: false, isRequired: true, displayName: '顧客ID', isForeign: true, references: 'customers.customer_id' },
                        { name: 'order_date', type: 'DATETIME', isPrimary: false, isRequired: true, displayName: '注文日時' },
                        { name: 'total_amount', type: 'DECIMAL(10,2)', isPrimary: false, isRequired: true, displayName: '合計金額' }
                    ]
                }
            };
            
            
            tablePositions = {
                'products': { x: 50, y: 50 },
                'customers': { x: 350, y: 50 },
                'orders': { x: 200, y: 200 }
            };
        }

        function loadClubPreset() {
            tables = {
                'clubs': {
                    name: 'clubs',
                    displayName: '部活',
                    fields: [
                        { name: 'club_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '部活ID' },
                        { name: 'club_name', type: 'VARCHAR(50)', isPrimary: false, isRequired: true, displayName: '部活名' },
                        { name: 'advisor', type: 'VARCHAR(50)', isPrimary: false, isRequired: false, displayName: '顧問' }
                    ]
                },
                'members': {
                    name: 'members',
                    displayName: '部員',
                    fields: [
                        { name: 'member_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '部員ID' },
                        { name: 'name', type: 'VARCHAR(50)', isPrimary: false, isRequired: true, displayName: '名前' },
                        { name: 'club_id', type: 'INT', isPrimary: false, isRequired: true, displayName: '部活ID', isForeign: true, references: 'clubs.club_id' },
                        { name: 'position', type: 'VARCHAR(20)', isPrimary: false, isRequired: false, displayName: '役職' }
                    ]
                },
                'competitions': {
                    name: 'competitions',
                    displayName: '大会',
                    fields: [
                        { name: 'competition_id', type: 'INT', isPrimary: true, isRequired: true, displayName: '大会ID' },
                        { name: 'name', type: 'VARCHAR(100)', isPrimary: false, isRequired: true, displayName: '大会名' },
                        { name: 'date', type: 'DATE', isPrimary: false, isRequired: true, displayName: '開催日' },
                        { name: 'location', type: 'VARCHAR(100)', isPrimary: false, isRequired: false, displayName: '会場' }
                    ]
                }
            };
            
            
            tablePositions = {
                'clubs': { x: 50, y: 50 },
                'members': { x: 300, y: 50 },
                'competitions': { x: 175, y: 200 }
            };
        }

        // テーブル表示更新
        function updateDisplay() {
            updateTableList();
            updateDataTableSelect();
            generateERDiagram();
        }

        // テーブルリスト更新
        function updateTableList() {
            const tableList = document.getElementById('tableList');
            if (Object.keys(tables).length === 0) {
                tableList.innerHTML = `
                    <p style="text-align: center; color: #718096; margin-top: 50px;">
                        まずはテーブルを作成してみましょう！<br>
                        上の「新しいテーブル」ボタンをクリックしてください。
                    </p>
                `;
                return;
            }

            tableList.innerHTML = '';
            Object.values(tables).forEach(table => {
                const tableItem = document.createElement('div');
                tableItem.className = 'table-item';
                tableItem.innerHTML = `
                    <div class="table-header">
                        <div class="table-name">${table.displayName || table.name}</div>
                        <div class="table-actions">
                            <button class="btn btn-small btn-secondary" onclick="editTable('${table.name}')">編集</button>
                            <button class="btn btn-small btn-danger" onclick="deleteTable('${table.name}')">削除</button>
                        </div>
                    </div>
                    <div class="field-list">
                        ${table.fields.map(field => `
                            <div class="field-item">
                                <div class="field-name">${field.displayName || field.name}</div>
                                <div class="field-type">${field.type}</div>
                                ${field.isPrimary ? '<div class="field-key primary-key">PK</div>' : ''}
                                ${field.isForeign ? '<div class="field-key foreign-key">FK</div>' : ''}
                                ${field.isRequired ? '<span style="color: #e53e3e;">*</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
                tableList.appendChild(tableItem);
            });
        }

        // 新しいテーブルモーダル表示
        function showNewTableModal() {
            currentEditingTable = null;
            document.getElementById('modalTitle').textContent = '新しいテーブル';
            document.getElementById('tableName').value = '';
            document.getElementById('fieldsList').innerHTML = '';
            addField(); // デフォルトで1つのフィールドを追加
            document.getElementById('tableModal').style.display = 'block';
        }

        // テーブル編集
        function editTable(tableName) {
            currentEditingTable = tableName;
            const table = tables[tableName];
            document.getElementById('modalTitle').textContent = 'テーブル編集';
            document.getElementById('tableName').value = table.name;
            
            const fieldsList = document.getElementById('fieldsList');
            fieldsList.innerHTML = '';
            
            table.fields.forEach((field, index) => {
                addField(field);
            });
            
            document.getElementById('tableModal').style.display = 'block';
        }

        // テーブル削除
        function deleteTable(tableName) {
            if (confirm(`テーブル「${tables[tableName].displayName || tableName}」を削除しますか？`)) {
                delete tables[tableName];
                delete tableData[tableName];
                relations = relations.filter(rel => rel.from !== tableName && rel.to !== tableName);
                delete tablePositions[tableName];
                updateDisplay();
                saveToStorage();
            }
        }

        // フィールド追加
        function addField(fieldData = null) {
            const fieldsList = document.getElementById('fieldsList');
            const fieldIndex = fieldsList.children.length;
            
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'field-item';
            fieldDiv.style.marginBottom = '10px';
            fieldDiv.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr 80px 80px 80px 40px; gap: 8px; align-items: center;">
                    <input type="text" placeholder="フィールド名" class="field-name-input" value="${fieldData ? fieldData.name : ''}" required>
                    <input type="text" placeholder="表示名" class="field-display-input" value="${fieldData ? fieldData.displayName || '' : ''}">
                    <select class="field-type-select">
                        <option value="INT" ${fieldData && fieldData.type === 'INT' ? 'selected' : ''}>整数</option>
                        <option value="VARCHAR(50)" ${fieldData && fieldData.type.startsWith('VARCHAR') ? 'selected' : ''}>文字列</option>
                        <option value="TEXT" ${fieldData && fieldData.type === 'TEXT' ? 'selected' : ''}>長文</option>
                        <option value="DATE" ${fieldData && fieldData.type === 'DATE' ? 'selected' : ''}>日付</option>
                        <option value="DATETIME" ${fieldData && fieldData.type === 'DATETIME' ? 'selected' : ''}>日時</option>
                        <option value="DECIMAL(10,2)" ${fieldData && fieldData.type.startsWith('DECIMAL') ? 'selected' : ''}>小数</option>
                        <option value="BOOLEAN" ${fieldData && fieldData.type === 'BOOLEAN' ? 'selected' : ''}>真偽値</option>
                    </select>
                    <label class="checkbox-group">
                        <input type="checkbox" class="field-primary-check" ${fieldData && fieldData.isPrimary ? 'checked' : ''}> PK
                    </label>
                    <label class="checkbox-group">
                        <input type="checkbox" class="field-required-check" ${fieldData && fieldData.isRequired ? 'checked' : ''}> 必須
                    </label>
                    <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px;">
                    <label class="checkbox-group">
                        <input type="checkbox" class="field-foreign-check" ${fieldData && fieldData.isForeign ? 'checked' : ''} onchange="toggleForeignKeySelect(this)"> 外部キー
                    </label>
                    <select class="field-reference-select" style="display: ${fieldData && fieldData.isForeign ? 'block' : 'none'};">
                        <option value="">参照先を選択</option>
                        ${generateReferenceOptions(fieldData)}
                    </select>
                </div>
            `;
            fieldsList.appendChild(fieldDiv);
        }

        // テーブルフォーム送信
        document.getElementById('tableForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const tableName = document.getElementById('tableName').value.trim();
            if (!tableName) {
                alert('テーブル名を入力してください');
                return;
            }

            // 既存テーブル名チェック（編集時は除く）
            if (!currentEditingTable && tables[tableName]) {
                alert('同じ名前のテーブルが既に存在します');
                return;
            }

            const fields = [];
            const fieldItems = document.querySelectorAll('#fieldsList .field-item');
            
            fieldItems.forEach(item => {
                const nameInput = item.querySelector('.field-name-input');
                const displayInput = item.querySelector('.field-display-input');
                const typeSelect = item.querySelector('.field-type-select');
                const primaryCheck = item.querySelector('.field-primary-check');
                const requiredCheck = item.querySelector('.field-required-check');
                
                if (nameInput.value.trim()) {
                    const foreignCheck = item.querySelector('.field-foreign-check');
                    const referenceSelect = item.querySelector('.field-reference-select');
                    
                    const field = {
                        name: nameInput.value.trim(),
                        displayName: displayInput.value.trim() || nameInput.value.trim(),
                        type: typeSelect.value,
                        isPrimary: primaryCheck.checked,
                        isRequired: requiredCheck.checked || primaryCheck.checked,
                        isForeign: foreignCheck.checked
                    };
                    
                    if (foreignCheck.checked && referenceSelect.value) {
                        field.references = referenceSelect.value;
                    }
                    
                    fields.push(field);
                }
            });

            if (fields.length === 0) {
                alert('最低1つのフィールドを追加してください');
                return;
            }

            // 主キーチェック
            const primaryKeys = fields.filter(f => f.isPrimary);
            if (primaryKeys.length === 0) {
                if (!confirm('主キーが設定されていません。このまま続けますか？')) {
                    return;
                }
            }

            // テーブル保存
            const tableData = {
                name: tableName,
                displayName: document.getElementById('tableName').value.trim(),
                fields: fields
            };

            if (currentEditingTable && currentEditingTable !== tableName) {
                // テーブル名が変更された場合
                delete tables[currentEditingTable];
                delete tableData[currentEditingTable];
                relations = relations.map(rel => {
                    if (rel.from === currentEditingTable) rel.from = tableName;
                    if (rel.to === currentEditingTable) rel.to = tableName;
                    return rel;
                });
                if (tablePositions[currentEditingTable]) {
                    tablePositions[tableName] = tablePositions[currentEditingTable];
                    delete tablePositions[currentEditingTable];
                }
            }

            tables[tableName] = tableData;
            
            // 新しいテーブルの場合、初期位置を設定
            if (!tablePositions[tableName]) {
                const existingCount = Object.keys(tablePositions).length;
                tablePositions[tableName] = {
                    x: 50 + (existingCount % 3) * 220,
                    y: 50 + Math.floor(existingCount / 3) * 180
                };
            }

            // 外部キーリレーションを自動検出・更新
            updateRelations();
            
            updateDisplay();
            saveToStorage();
            closeModal('tableModal');
        });

        // モーダル閉じる
        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

        // 全削除
        function clearAll() {
            if (confirm('全てのテーブルとデータを削除しますか？この操作は取り消せません。')) {
                tables = {};
                tableData = {};
                relations = [];
                tablePositions = {};
                updateDisplay();
                saveToStorage();
            }
        }

        // ER図生成
        function generateERDiagram() {
            const diagramContainer = document.getElementById('erDiagram');
            
            if (Object.keys(tables).length === 0) {
                diagramContainer.innerHTML = `
                    <p style="text-align: center; color: #718096; margin-top: 180px;">
                        テーブルを作成すると、ここにER図が表示されます
                    </p>
                `;
                return;
            }

            // 既存の要素をクリア
            diagramContainer.innerHTML = '';

            // テーブル要素を作成
            Object.entries(tables).forEach(([tableName, table]) => {
                const tableDiv = document.createElement('div');
                tableDiv.className = 'diagram-table';
                tableDiv.id = `diagram-${tableName}`;
                
                const position = tablePositions[tableName] || { x: 50, y: 50 };
                tableDiv.style.left = position.x + 'px';
                tableDiv.style.top = position.y + 'px';
                
                tableDiv.innerHTML = `
                    <div class="diagram-table-header">${table.displayName || table.name}</div>
                    ${table.fields.map(field => `
                        <div class="diagram-field">
                            <span>${field.displayName || field.name}</span>
                            <span style="display: flex; gap: 4px;">
                                ${field.isPrimary ? '<span class="primary-key">PK</span>' : ''}
                                ${field.isForeign ? '<span class="foreign-key">FK</span>' : ''}
                            </span>
                        </div>
                    `).join('')}
                `;

                // ドラッグ機能
                let isDragging = false;
                let startX, startY, initialX, initialY;

                tableDiv.addEventListener('mousedown', function(e) {
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    initialX = position.x;
                    initialY = position.y;
                    tableDiv.style.zIndex = '100';
                });

                document.addEventListener('mousemove', function(e) {
                    if (isDragging && e.target.closest(`#diagram-${tableName}`)) {
                        const deltaX = e.clientX - startX;
                        const deltaY = e.clientY - startY;
                        const newX = Math.max(0, initialX + deltaX);
                        const newY = Math.max(0, initialY + deltaY);
                        
                        tableDiv.style.left = newX + 'px';
                        tableDiv.style.top = newY + 'px';
                        
                        tablePositions[tableName] = { x: newX, y: newY };
                    }
                });

                document.addEventListener('mouseup', function() {
                    if (isDragging) {
                        isDragging = false;
                        tableDiv.style.zIndex = '10';
                        drawRelationLines();
                        saveToStorage();
                    }
                });

                diagramContainer.appendChild(tableDiv);
            });

            // リレーション線を描画
            setTimeout(() => drawRelationLines(), 100);
        }

        // リレーション線描画
        function drawRelationLines() {
            // 既存の線を削除
            document.querySelectorAll('.relation-line').forEach(line => line.remove());

            const diagramContainer = document.getElementById('erDiagram');
            
            relations.forEach(relation => {
                const fromTable = document.getElementById(`diagram-${relation.from}`);
                const toTable = document.getElementById(`diagram-${relation.to}`);
                
                if (fromTable && toTable) {
                    // 具体的なフィールドの位置を取得（相互参照で最適な方向を決定）
                    const fromFieldPos = getFieldPosition(fromTable, relation.fromField, toTable);
                    const toFieldPos = getFieldPosition(toTable, relation.toField, fromTable);
                    
                    if (fromFieldPos && toFieldPos) {
                        const containerRect = diagramContainer.getBoundingClientRect();
                        
                        // コンテナ相対位置に変換
                        const fromX = fromFieldPos.x - containerRect.left;
                        const fromY = fromFieldPos.y - containerRect.top;
                        const toX = toFieldPos.x - containerRect.left;
                        const toY = toFieldPos.y - containerRect.top;
                        
                        // 線を描画
                        drawLine(diagramContainer, fromX, fromY, toX, toY, relation, fromFieldPos.side, toFieldPos.side);
                    }
                }
            });
        }

        // フィールドの画面上の位置を取得
        function getFieldPosition(tableElement, fieldName, targetTableElement) {
            const fields = tableElement.querySelectorAll('.diagram-field');
            for (let field of fields) {
                const fieldText = field.querySelector('span').textContent;
                const table = tables[tableElement.id.replace('diagram-', '')];
                const tableField = table.fields.find(f => 
                    (f.displayName || f.name) === fieldText || f.name === fieldName
                );
                
                if (tableField && tableField.name === fieldName) {
                    const fieldRect = field.getBoundingClientRect();
                    const tableRect = tableElement.getBoundingClientRect();
                    const targetRect = targetTableElement.getBoundingClientRect();
                    
                    // テーブルの中心同士の位置関係を判定
                    const tableCenterX = tableRect.left + tableRect.width / 2;
                    const targetCenterX = targetRect.left + targetRect.width / 2;
                    
                    // 最短距離で接続点を決定
                    let connectionX;
                    if (tableCenterX < targetCenterX) {
                        // ターゲットが右側にある場合、右端から線を引く
                        connectionX = fieldRect.right;
                    } else {
                        // ターゲットが左側にある場合、左端から線を引く
                        connectionX = fieldRect.left;
                    }
                    
                    return {
                        x: connectionX,
                        y: fieldRect.top + fieldRect.height / 2,
                        side: tableCenterX < targetCenterX ? 'right' : 'left'
                    };
                }
            }
            return null;
        }

        // 2点間に線を描画（改良版：より自然な線の描画）
        function drawLine(container, fromX, fromY, toX, toY, relation, fromSide, toSide) {
            // 直線距離を計算
            const deltaX = toX - fromX;
            const deltaY = toY - fromY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // 短い距離の場合は直線で描画
            if (distance < 100) {
                drawStraightLine(container, fromX, fromY, toX, toY, relation);
                return;
            }
            
            // 長い距離またはテーブルが重なりそうな場合は、L字型の線で描画
            if (Math.abs(deltaX) > Math.abs(deltaY) * 2) {
                drawLShapedLine(container, fromX, fromY, toX, toY, relation, fromSide, toSide);
            } else {
                drawStraightLine(container, fromX, fromY, toX, toY, relation);
            }
        }
        
        // 直線を描画
        function drawStraightLine(container, fromX, fromY, toX, toY, relation) {
            const line = document.createElement('div');
            line.className = 'relation-line';
            line.title = `${relation.from}.${relation.fromField} → ${relation.to}.${relation.toField}`;
            
            const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
            const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
            
            line.style.left = fromX + 'px';
            line.style.top = fromY + 'px';
            line.style.width = length + 'px';
            line.style.transform = `rotate(${angle}deg)`;
            line.style.transformOrigin = '0 50%';
            line.style.position = 'relative';
            
            // 矢印を追加
            line.innerHTML = '<div style="position: absolute; right: -6px; top: -4px; width: 0; height: 0; border-left: 8px solid #4299e1; border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>';
            
            // ホバー効果
            addLineHoverEffect(line);
            container.appendChild(line);
        }
        
        // L字型の線を描画
        function drawLShapedLine(container, fromX, fromY, toX, toY, relation, fromSide, toSide) {
            const midX = fromX + (toX - fromX) * 0.5;
            
            // 水平線（from → 中間点）
            const horizontalLine = document.createElement('div');
            horizontalLine.className = 'relation-line';
            horizontalLine.title = `${relation.from}.${relation.fromField} → ${relation.to}.${relation.toField}`;
            
            const horizontalLength = Math.abs(midX - fromX);
            horizontalLine.style.left = Math.min(fromX, midX) + 'px';
            horizontalLine.style.top = fromY + 'px';
            horizontalLine.style.width = horizontalLength + 'px';
            horizontalLine.style.height = '2px';
            
            // 垂直線（中間点 → to）
            const verticalLine = document.createElement('div');
            verticalLine.className = 'relation-line';
            verticalLine.title = `${relation.from}.${relation.fromField} → ${relation.to}.${relation.toField}`;
            
            const verticalLength = Math.abs(toY - fromY);
            verticalLine.style.left = midX + 'px';
            verticalLine.style.top = Math.min(fromY, toY) + 'px';
            verticalLine.style.width = '2px';
            verticalLine.style.height = verticalLength + 'px';
            
            // 最終線（中間点 → to）
            const finalLine = document.createElement('div');
            finalLine.className = 'relation-line';
            finalLine.title = `${relation.from}.${relation.fromField} → ${relation.to}.${relation.toField}`;
            
            const finalLength = Math.abs(toX - midX);
            finalLine.style.left = Math.min(midX, toX) + 'px';
            finalLine.style.top = toY + 'px';
            finalLine.style.width = finalLength + 'px';
            finalLine.style.height = '2px';
            
            // 矢印を最終線に追加
            finalLine.style.position = 'relative';
            finalLine.innerHTML = '<div style="position: absolute; right: -6px; top: -4px; width: 0; height: 0; border-left: 8px solid #4299e1; border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>';
            
            // ホバー効果を全ての線に追加
            [horizontalLine, verticalLine, finalLine].forEach(line => {
                addLineHoverEffect(line);
                container.appendChild(line);
            });
        }
        
        // 線のホバー効果を追加
        function addLineHoverEffect(line) {
            line.addEventListener('mouseenter', function() {
                line.style.backgroundColor = '#2b6cb0';
                if (line.style.width !== '2px') {
                    line.style.height = '3px';
                } else {
                    line.style.width = '3px';
                }
            });
            
            line.addEventListener('mouseleave', function() {
                line.style.backgroundColor = '#4299e1';
                if (line.style.height === '3px') {
                    line.style.height = '2px';
                } else if (line.style.width === '3px') {
                    line.style.width = '2px';
                }
            });
        }

        // データ入力関連
        function updateDataTableSelect() {
            const select = document.getElementById('selectTable');
            select.innerHTML = '<option value="">テーブルを選択してください</option>';
            
            Object.values(tables).forEach(table => {
                const option = document.createElement('option');
                option.value = table.name;
                option.textContent = table.displayName || table.name;
                select.appendChild(option);
            });
        }

        function showDataEntryModal() {
            updateDataTableSelect();
            document.getElementById('dataModal').style.display = 'block';
        }

        function updateDataForm() {
            const selectedTable = document.getElementById('selectTable').value;
            const dataFields = document.getElementById('dataFields');
            
            if (!selectedTable || !tables[selectedTable]) {
                dataFields.innerHTML = '';
                return;
            }

            const table = tables[selectedTable];
            dataFields.innerHTML = table.fields.map(field => `
                <div class="form-group">
                    <label for="data_${field.name}">
                        ${field.displayName || field.name}
                        ${field.isRequired ? '<span style="color: #e53e3e;">*</span>' : ''}
                        <span style="color: #718096; font-size: 12px;">(${field.type})</span>
                    </label>
                    <input type="text" id="data_${field.name}" name="${field.name}" 
                           ${field.isRequired ? 'required' : ''} 
                           placeholder="${getPlaceholderForField(field)}">
                </div>
            `).join('');
        }

        function getPlaceholderForField(field) {
            switch(field.type) {
                case 'INT': return '例: 123';
                case 'DATE': return '例: 2024-01-01';
                case 'DATETIME': return '例: 2024-01-01 12:00:00';
                default: return field.displayName ? `例: ${field.displayName}の値` : '';
            }
        }

        // データフォーム送信
        document.getElementById('dataForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const selectedTable = document.getElementById('selectTable').value;
            if (!selectedTable) {
                alert('テーブルを選択してください');
                return;
            }

            const formData = new FormData(this);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value.trim();
            }

            if (!tableData[selectedTable]) {
                tableData[selectedTable] = [];
            }

            tableData[selectedTable].push(data);
            updateDataDisplay();
            saveToStorage();
            closeModal('dataModal');
            
            // フォームリセット
            document.getElementById('dataFields').innerHTML = '';
            document.getElementById('selectTable').value = '';
        });

        function updateDataDisplay() {
            const dataDisplay = document.getElementById('dataDisplay');
            
            if (Object.keys(tableData).length === 0) {
                dataDisplay.innerHTML = `
                    <p style="text-align: center; color: #718096; margin: 20px 0;">
                        テーブルにデータを追加してみましょう
                    </p>
                `;
                return;
            }

            let html = '';
            Object.entries(tableData).forEach(([tableName, data]) => {
                if (data.length > 0) {
                    const table = tables[tableName];
                    html += `
                        <h3>${table.displayName || tableName}</h3>
                        <div style="overflow-x: auto; margin-bottom: 20px;">
                            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
                                <thead>
                                    <tr style="background: #f7fafc;">
                                        ${table.fields.map(field => 
                                            `<th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">
                                                ${field.displayName || field.name}
                                            </th>`
                                        ).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map(row => `
                                        <tr>
                                            ${table.fields.map(field => 
                                                `<td style="padding: 8px; border: 1px solid #e2e8f0;">
                                                    ${row[field.name] || ''}
                                                </td>`
                                            ).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            });

            dataDisplay.innerHTML = html || `
                <p style="text-align: center; color: #718096; margin: 20px 0;">
                    データがまだ入力されていません
                </p>
            `;
        }

        // SQL生成
        function generateSQL() {
            const sqlOutput = document.getElementById('sqlOutput');
            let sql = '-- データベース作成SQL\n\n';

            // CREATE TABLE文生成
            Object.values(tables).forEach(table => {
                sql += `-- ${table.displayName || table.name}テーブル\n`;
                sql += `CREATE TABLE ${table.name} (\n`;
                
                const fieldDefinitions = table.fields.map(field => {
                    let def = `    ${field.name} ${field.type}`;
                    if (field.isRequired) def += ' NOT NULL';
                    return def;
                });

                const primaryKeys = table.fields.filter(f => f.isPrimary).map(f => f.name);
                if (primaryKeys.length > 0) {
                    fieldDefinitions.push(`    PRIMARY KEY (${primaryKeys.join(', ')})`);
                }

                sql += fieldDefinitions.join(',\n');
                sql += '\n);\n\n';
            });

            // INSERT文生成
            Object.entries(tableData).forEach(([tableName, data]) => {
                if (data.length > 0) {
                    const table = tables[tableName];
                    sql += `-- ${table.displayName || tableName}テーブルのデータ\n`;
                    
                    data.forEach(row => {
                        const fields = table.fields.map(f => f.name);
                        const values = fields.map(field => {
                            const value = row[field];
                            if (!value) return 'NULL';
                            
                            const fieldDef = table.fields.find(f => f.name === field);
                            if (fieldDef.type === 'INT' || fieldDef.type.startsWith('DECIMAL')) {
                                return value;
                            }
                            return `'${value.replace(/'/g, "''")}'`;
                        });
                        
                        sql += `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${values.join(', ')});\n`;
                    });
                    sql += '\n';
                }
            });

            sqlOutput.textContent = sql;
        }

        function copySQL() {
            const sqlOutput = document.getElementById('sqlOutput');
            navigator.clipboard.writeText(sqlOutput.textContent).then(() => {
                alert('SQLをクリップボードにコピーしました！');
            }).catch(() => {
                alert('コピーに失敗しました');
            });
        }

        // タブ切り替え
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
        }

        // 設計バリデーション
        function validateDesign() {
            const validationResults = document.getElementById('validationResults');
            const errors = [];
            const warnings = [];
            const suggestions = [];

            // 各テーブルをチェック
            Object.values(tables).forEach(table => {
                // 主キーチェック
                const primaryKeys = table.fields.filter(f => f.isPrimary);
                if (primaryKeys.length === 0) {
                    errors.push(`テーブル「${table.displayName || table.name}」に主キーが設定されていません`);
                }

                // フィールド名の重複チェック
                const fieldNames = table.fields.map(f => f.name);
                const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
                if (duplicates.length > 0) {
                    errors.push(`テーブル「${table.displayName || table.name}」でフィールド名が重複しています: ${duplicates.join(', ')}`);
                }

                // 外部キーの整合性チェック
                table.fields.forEach(field => {
                    if (field.isForeign && field.references) {
                        const [refTable, refField] = field.references.split('.');
                        if (!tables[refTable]) {
                            errors.push(`外部キー「${field.name}」が参照するテーブル「${refTable}」が存在しません`);
                        } else if (!tables[refTable].fields.find(f => f.name === refField)) {
                            errors.push(`外部キー「${field.name}」が参照するフィールド「${refField}」が存在しません`);
                        }
                    }
                });

                // データ型の妥当性チェック
                table.fields.forEach(field => {
                    if (field.type === 'INT' && field.name.toLowerCase().includes('name')) {
                        warnings.push(`「${table.displayName || table.name}」の「${field.displayName || field.name}」は名前のようですが、データ型がINTになっています`);
                    }
                });
            });

            // 提案事項
            if (Object.keys(tables).length > 1 && relations.length === 0) {
                suggestions.push('複数のテーブルがありますが、リレーション（関連）が設定されていません。テーブル間の関係を検討してみてください。');
            }

            // 結果表示
            let html = '<div style="max-height: 300px; overflow-y: auto;">';
            
            if (errors.length > 0) {
                html += '<h4 style="color: #e53e3e; margin-bottom: 10px;">🚨 エラー</h4>';
                errors.forEach(error => {
                    html += `<div class="validation-error">❌ ${error}</div>`;
                });
            }

            if (warnings.length > 0) {
                html += '<h4 style="color: #f6ad55; margin: 15px 0 10px 0;">⚠️ 警告</h4>';
                warnings.forEach(warning => {
                    html += `<div style="color: #f6ad55; font-size: 12px; margin-top: 5px;">⚠️ ${warning}</div>`;
                });
            }

            if (suggestions.length > 0) {
                html += '<h4 style="color: #4299e1; margin: 15px 0 10px 0;">💡 提案</h4>';
                suggestions.forEach(suggestion => {
                    html += `<div style="color: #4299e1; font-size: 12px; margin-top: 5px;">💡 ${suggestion}</div>`;
                });
            }

            if (errors.length === 0 && warnings.length === 0) {
                html += '<div class="success-message">✅ 設計に問題は見つかりませんでした！</div>';
            }

            html += '</div>';
            validationResults.innerHTML = html;
        }

        // サンプルデータ追加
        function addSampleData() {
            Object.keys(tables).forEach(tableName => {
                if (!tableData[tableName]) {
                    tableData[tableName] = [];
                }
                
                // 各テーブルに応じたサンプルデータ
                const table = tables[tableName];
                const sampleData = generateSampleDataForTable(table);
                tableData[tableName].push(...sampleData);
            });
            
            updateDataDisplay();
            saveToStorage();
            alert('サンプルデータを追加しました！');
        }

        function generateSampleDataForTable(table) {
            const samples = [];
            const tableName = table.name;
            
            // テーブル名に応じてサンプルデータを生成
            if (tableName === 'students') {
                samples.push(
                    { student_id: '1', name: '田中太郎', class_id: '1', birth_date: '2008-04-15' },
                    { student_id: '2', name: '佐藤花子', class_id: '1', birth_date: '2008-08-22' },
                    { student_id: '3', name: '鈴木次郎', class_id: '2', birth_date: '2008-12-03' }
                );
            } else if (tableName === 'classes') {
                samples.push(
                    { class_id: '1', class_name: '1年A組', grade: '1', teacher_name: '山田先生' },
                    { class_id: '2', class_name: '1年B組', grade: '1', teacher_name: '田中先生' }
                );
            } else if (tableName === 'subjects') {
                samples.push(
                    { subject_id: '1', subject_name: '数学', credits: '4' },
                    { subject_id: '2', subject_name: '英語', credits: '4' },
                    { subject_id: '3', subject_name: '国語', credits: '4' }
                );
            } else if (tableName === 'books') {
                samples.push(
                    { book_id: '1', title: 'データベース入門', author: '情報太郎', isbn: '978-4-12345-678-9' },
                    { book_id: '2', title: 'プログラミング基礎', author: 'コード花子', isbn: '978-4-98765-432-1' }
                );
            } else if (tableName === 'users') {
                samples.push(
                    { user_id: '1', name: '図書太郎', email: 'tosho@example.com' },
                    { user_id: '2', name: '読書花子', email: 'dokusho@example.com' }
                );
            } else if (tableName === 'loans') {
                samples.push(
                    { loan_id: '1', book_id: '1', user_id: '1', loan_date: '2024-01-15', return_date: '' },
                    { loan_id: '2', book_id: '2', user_id: '2', loan_date: '2024-01-20', return_date: '2024-01-25' }
                );
            }
            
            return samples;
        }

        // CSV読み込み（簡易版）
        function importCSV() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const csv = e.target.result;
                            const lines = csv.split('\n');
                            const headers = lines[0].split(',').map(h => h.trim());
                            
                            // 簡易的なCSV解析（実用版ではより堅牢な解析が必要）
                            const data = lines.slice(1).filter(line => line.trim()).map(line => {
                                const values = line.split(',');
                                const row = {};
                                headers.forEach((header, index) => {
                                    row[header] = values[index] ? values[index].trim() : '';
                                });
                                return row;
                            });
                            
                            console.log('CSV データ:', data);
                            alert(`CSVファイルから${data.length}件のデータを読み込みました（機能開発中）`);
                        } catch (error) {
                            alert('CSVファイルの読み込みに失敗しました');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }

        // 図の保存（簡易版）
        function exportDiagram() {
            alert('図の保存機能は開発中です。ブラウザのスクリーンショット機能をご利用ください。');
        }

        // モーダル外クリックで閉じる
        window.onclick = function(event) {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // 外部キー選択の表示切り替え
        function toggleForeignKeySelect(checkbox) {
            const referenceSelect = checkbox.closest('.field-item').querySelector('.field-reference-select');
            referenceSelect.style.display = checkbox.checked ? 'block' : 'none';
            
            if (checkbox.checked) {
                // 参照先オプションを更新
                updateReferenceOptions(referenceSelect);
            }
        }

        // 参照先オプション生成
        function generateReferenceOptions(fieldData) {
            let options = '';
            Object.values(tables).forEach(table => {
                table.fields.forEach(field => {
                    if (field.isPrimary) {
                        const selected = fieldData && fieldData.references === `${table.name}.${field.name}` ? 'selected' : '';
                        options += `<option value="${table.name}.${field.name}" ${selected}>${table.displayName || table.name}.${field.displayName || field.name}</option>`;
                    }
                });
            });
            return options;
        }

        // 参照先オプション更新
        function updateReferenceOptions(selectElement) {
            const currentValue = selectElement.value;
            selectElement.innerHTML = '<option value="">参照先を選択</option>';
            
            Object.values(tables).forEach(table => {
                table.fields.forEach(field => {
                    if (field.isPrimary) {
                        const option = document.createElement('option');
                        option.value = `${table.name}.${field.name}`;
                        option.textContent = `${table.displayName || table.name}.${field.displayName || field.name}`;
                        if (option.value === currentValue) {
                            option.selected = true;
                        }
                        selectElement.appendChild(option);
                    }
                });
            });
        }

        // リレーション自動更新
        function updateRelations() {
            // 既存のリレーションをクリア
            relations = [];
            
            // 全テーブルの外部キーからリレーションを構築
            Object.values(tables).forEach(table => {
                table.fields.forEach(field => {
                    if (field.isForeign && field.references) {
                        const [refTable, refField] = field.references.split('.');
                        if (tables[refTable]) {
                            relations.push({
                                from: table.name,
                                to: refTable,
                                fromField: field.name,
                                toField: refField
                            });
                        }
                    }
                });
            });
        }

        // 設計保存・読み込み機能
        
        // 簡単な保存（ツールバー用）
        function exportDesign() {
            const designName = `設計_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '')}`;
            const design = getCurrentDesign();
            design.name = designName;
            design.description = '手動エクスポート';
            
            downloadDesignFile(design);
        }

        // 簡単な読み込み（ツールバー用）
        function importDesign() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const design = JSON.parse(e.target.result);
                            loadDesign(design);
                            alert(`「${design.name || 'Unknown'}」を読み込みました！`);
                        } catch (error) {
                            alert('ファイルの読み込みに失敗しました。形式を確認してください。');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }

        // 保存管理モーダル表示
        function showSaveManagementModal() {
            updateSavedDesignsList();
            document.getElementById('saveManagementModal').style.display = 'block';
        }

        // 現在の設計データを取得
        function getCurrentDesign() {
            return {
                timestamp: Date.now(),
                version: '1.0',
                tables: JSON.parse(JSON.stringify(tables)),
                tableData: JSON.parse(JSON.stringify(tableData)),
                relations: JSON.parse(JSON.stringify(relations)),
                tablePositions: JSON.parse(JSON.stringify(tablePositions))
            };
        }

        // 設計を保存
        function saveCurrentDesign() {
            const name = document.getElementById('saveName').value.trim();
            const description = document.getElementById('saveDescription').value.trim();
            
            if (!name) {
                alert('保存名を入力してください');
                return;
            }

            const design = getCurrentDesign();
            design.name = name;
            design.description = description;
            design.savedAt = new Date().toISOString();

            const saveId = `save_${Date.now()}`;
            savedDesigns[saveId] = design;

            saveToStorage();
            updateSavedDesignsList();
            
            // フォームクリア
            document.getElementById('saveName').value = '';
            document.getElementById('saveDescription').value = '';
            
            alert(`「${name}」として保存しました！`);
        }

        // 設計を読み込み
        function loadDesign(design) {
            tables = design.tables || {};
            tableData = design.tableData || {};
            relations = design.relations || [];
            tablePositions = design.tablePositions || {};
            
            updateRelations();
            updateDisplay();
            saveToStorage();
        }

        // 保存済み設計を読み込み
        function loadSavedDesign(saveId) {
            if (savedDesigns[saveId]) {
                const design = savedDesigns[saveId];
                if (confirm(`「${design.name}」を読み込みますか？現在の作業内容は失われます。`)) {
                    loadDesign(design);
                    closeModal('saveManagementModal');
                    alert(`「${design.name}」を読み込みました！`);
                }
            }
        }

        // 保存済み設計を削除
        function deleteSavedDesign(saveId) {
            if (savedDesigns[saveId]) {
                const design = savedDesigns[saveId];
                if (confirm(`「${design.name}」を削除しますか？この操作は取り消せません。`)) {
                    delete savedDesigns[saveId];
                    saveToStorage();
                    updateSavedDesignsList();
                    alert('設計を削除しました');
                }
            }
        }

        // 保存済み設計一覧を更新
        function updateSavedDesignsList() {
            const container = document.getElementById('savedDesignsList');
            
            if (Object.keys(savedDesigns).length === 0) {
                container.innerHTML = `
                    <p style="text-align: center; color: #718096; margin: 20px 0;">
                        保存済みの設計がありません
                    </p>
                `;
                return;
            }

            let html = '';
            Object.entries(savedDesigns)
                .sort(([,a], [,b]) => b.timestamp - a.timestamp)
                .forEach(([saveId, design]) => {
                    const savedDate = new Date(design.savedAt || design.timestamp).toLocaleString('ja-JP');
                    const tableCount = Object.keys(design.tables || {}).length;
                    const dataCount = Object.values(design.tableData || {}).reduce((sum, data) => sum + data.length, 0);
                    
                    html += `
                        <div class="table-item" style="margin-bottom: 10px;">
                            <div class="table-header">
                                <div>
                                    <div class="table-name">${design.name}</div>
                                    <div style="font-size: 12px; color: #718096; margin-top: 2px;">
                                        ${savedDate} | テーブル数: ${tableCount} | データ数: ${dataCount}
                                    </div>
                                    ${design.description ? `<div style="font-size: 11px; color: #4a5568; margin-top: 2px;">${design.description}</div>` : ''}
                                </div>
                                <div class="table-actions">
                                    <button class="btn btn-small" onclick="loadSavedDesign('${saveId}')">読込</button>
                                    <button class="btn btn-small btn-secondary" onclick="exportSavedDesign('${saveId}')">出力</button>
                                    <button class="btn btn-small btn-danger" onclick="deleteSavedDesign('${saveId}')">削除</button>
                                </div>
                            </div>
                        </div>
                    `;
                });

            container.innerHTML = html;
        }

        // ファイルに出力
        function exportToFile() {
            const name = document.getElementById('saveName').value.trim() || `設計_${new Date().toISOString().slice(0, 10)}`;
            const description = document.getElementById('saveDescription').value.trim();
            
            const design = getCurrentDesign();
            design.name = name;
            design.description = description;
            design.savedAt = new Date().toISOString();
            
            downloadDesignFile(design);
        }

        // 保存済み設計をファイル出力
        function exportSavedDesign(saveId) {
            if (savedDesigns[saveId]) {
                downloadDesignFile(savedDesigns[saveId]);
            }
        }

        // 設計ファイルをダウンロード
        function downloadDesignFile(design) {
            const dataStr = JSON.stringify(design, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${design.name || 'database_design'}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert(`「${design.name || 'database_design'}.json」をダウンロードしました！`);
        }

        // ファイルから読み込み
        function importFromFile() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const design = JSON.parse(e.target.result);
                            
                            // 現在の設計として読み込むか、保存リストに追加するかを選択
                            const action = confirm(
                                `「${design.name || file.name}」をどう処理しますか？\n\n` +
                                'OK: 現在の設計として読み込む（現在の作業は失われます）\n' +
                                'キャンセル: 保存リストに追加する'
                            );
                            
                            if (action) {
                                // 現在の設計として読み込み
                                loadDesign(design);
                                closeModal('saveManagementModal');
                                alert(`「${design.name || file.name}」を読み込みました！`);
                            } else {
                                // 保存リストに追加
                                const saveId = `import_${Date.now()}`;
                                design.savedAt = new Date().toISOString();
                                if (!design.name) {
                                    design.name = file.name.replace('.json', '');
                                }
                                savedDesigns[saveId] = design;
                                saveToStorage();
                                updateSavedDesignsList();
                                alert(`「${design.name}」を保存リストに追加しました！`);
                            }
                        } catch (error) {
                            alert('ファイルの読み込みに失敗しました。JSON形式を確認してください。');
                            console.error('Import error:', error);
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }

        // 全保存データを削除
        function clearAllSaves() {
            if (Object.keys(savedDesigns).length === 0) {
                alert('削除する保存データがありません');
                return;
            }
            
            if (confirm('全ての保存済み設計を削除しますか？この操作は取り消せません。')) {
                savedDesigns = {};
                saveToStorage();
                updateSavedDesignsList();
                alert('全ての保存データを削除しました');
            }
        }

        // モード切り替え機能
        function switchMode(mode) {
            currentMode = mode;
            
            // ボタンの状態更新
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`${mode}ModeBtn`).classList.add('active');
            
            // コンテンツの表示切り替え
            document.getElementById('designPresets').style.display = mode === 'design' ? 'grid' : 'none';
            document.getElementById('designContent').style.display = mode === 'design' ? 'grid' : 'none';
            document.getElementById('learningContent').style.display = mode === 'learning' ? 'block' : 'none';
            document.getElementById('quizContent').style.display = mode === 'quiz' ? 'block' : 'none';
            document.getElementById('sqlContent').style.display = mode === 'sql' ? 'block' : 'none';
            
            if (mode === 'learning') {
                updateLearningProgress();
            } else if (mode === 'quiz') {
                updateQuizProgress();
            } else if (mode === 'sql') {
                initializeSQLMode();
            }
        }

        // 学習進捗更新
        function updateLearningProgress() {
            const lessons = ['basics', 'tables', 'keys', 'normalization', 'er-diagram', 'sql-basics', 'practical', 'review'];
            let completedCount = 0;
            
            lessons.forEach(lesson => {
                const status = learningProgress[lesson] || 'not-started';
                const statusElement = document.getElementById(`lesson-${lesson}-status`);
                if (statusElement) {
                    statusElement.textContent = status === 'completed' ? '✅ 完了' : 
                                               status === 'in-progress' ? '📚 学習中' : '未学習';
                    statusElement.style.color = status === 'completed' ? '#38a169' : 
                                               status === 'in-progress' ? '#4299e1' : '#718096';
                }
                if (status === 'completed') completedCount++;
            });
            
            const progressPercent = (completedCount / lessons.length) * 100;
            document.getElementById('overallProgress').style.width = progressPercent + '%';
            document.getElementById('progressText').textContent = `${completedCount}/${lessons.length}`;
        }

        // テスト進捗更新
        function updateQuizProgress() {
            const quizzes = ['basic-concepts', 'table-design', 'relationships', 'normalization', 'er-diagrams', 'comprehensive'];
            let totalScore = 0;
            let completedCount = 0;
            
            quizzes.forEach(quiz => {
                const score = quizScores[quiz];
                const scoreElement = document.getElementById(`quiz-${quiz}-score`);
                if (scoreElement) {
                    if (score !== undefined) {
                        scoreElement.textContent = `${score}点`;
                        scoreElement.style.color = score >= 70 ? '#38a169' : score >= 50 ? '#f6ad55' : '#e53e3e';
                        totalScore += score;
                        completedCount++;
                    } else {
                        scoreElement.textContent = '未受験';
                        scoreElement.style.color = '#718096';
                    }
                }
            });
            
            const averageScore = completedCount > 0 ? Math.round(totalScore / completedCount) : 0;
            document.getElementById('averageScore').textContent = averageScore;
            document.getElementById('completedQuizzes').textContent = `${completedCount}/${quizzes.length}`;
            
            const progressPercent = (completedCount / quizzes.length) * 100;
            document.getElementById('quizProgress').style.width = progressPercent + '%';
        }

        // レッスン開始
        function startLesson(lessonId) {
            currentLesson = lessonId;
            currentLessonStep = 0;
            learningProgress[lessonId] = 'in-progress';
            
            const lessons = getLessonContent();
            const lesson = lessons[lessonId];
            
            document.getElementById('lessonTitle').textContent = lesson.title;
            showLessonStep();
            document.getElementById('lessonModal').style.display = 'block';
            
            saveToStorage();
            updateLearningProgress();
        }

        // レッスンステップ表示
        function showLessonStep() {
            const lessons = getLessonContent();
            const lesson = lessons[currentLesson];
            const step = lesson.steps[currentLessonStep];
            
            document.getElementById('lessonContent').innerHTML = step.content;
            
            // ボタンの表示制御
            document.getElementById('prevLessonBtn').style.display = currentLessonStep > 0 ? 'inline-block' : 'none';
            document.getElementById('nextLessonBtn').style.display = currentLessonStep < lesson.steps.length - 1 ? 'inline-block' : 'none';
            document.getElementById('completeLessonBtn').style.display = currentLessonStep === lesson.steps.length - 1 ? 'inline-block' : 'none';
            
            // 特別な処理
            if (step.interactive) {
                executeInteractiveContent(step.interactive);
            }
        }

        // 次のレッスンステップ
        function nextLessonStep() {
            const lessons = getLessonContent();
            const lesson = lessons[currentLesson];
            if (currentLessonStep < lesson.steps.length - 1) {
                currentLessonStep++;
                showLessonStep();
            }
        }

        // 前のレッスンステップ
        function previousLessonStep() {
            if (currentLessonStep > 0) {
                currentLessonStep--;
                showLessonStep();
            }
        }

        // レッスン完了
        function completeLesson() {
            learningProgress[currentLesson] = 'completed';
            saveToStorage();
            updateLearningProgress();
            closeModal('lessonModal');
            alert('🎉 レッスンを完了しました！');
        }

        // レッスンコンテンツ定義
        function getLessonContent() {
            return {
                'basics': {
                    title: '📖 第1章：データベース基礎',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>データベースとは何でしょうか？</h3>
                                    <p>データベース（Database）は、<strong>データを組織化して格納・管理するシステム</strong>です。</p>
                                    <h4>🏫 身近な例：学校の生徒管理</h4>
                                    <ul>
                                        <li>📝 出席簿：生徒の名前、出席状況</li>
                                        <li>📊 成績表：科目別の点数、評価</li>
                                        <li>📋 連絡先：保護者の電話番号、住所</li>
                                    </ul>
                                    <p>これらの情報をバラバラに管理すると、<span style="color: #e53e3e;">探すのが大変</span>ですよね？</p>
                                    <p>データベースは、これらを<span style="color: #38a169;">効率的に管理</span>できるようにします！</p>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>なぜデータベースが必要なのか？</h3>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div style="background: #fed7d7; padding: 15px; border-radius: 8px;">
                                            <h4>❌ データベースなし</h4>
                                            <ul>
                                                <li>ファイルがバラバラ</li>
                                                <li>同じデータの重複</li>
                                                <li>更新が大変</li>
                                                <li>検索に時間がかかる</li>
                                            </ul>
                                        </div>
                                        <div style="background: #c6f6d5; padding: 15px; border-radius: 8px;">
                                            <h4>✅ データベースあり</h4>
                                            <ul>
                                                <li>データが整理されている</li>
                                                <li>重複がない</li>
                                                <li>一括更新が可能</li>
                                                <li>高速検索</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>リレーショナルデータベースの基本概念</h3>
                                    <h4>🗃️ テーブル（表）</h4>
                                    <p>データを<strong>行と列</strong>で整理した表です。</p>
                                    <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <thead>
                                                <tr style="background: #e2e8f0;">
                                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">生徒ID</th>
                                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">名前</th>
                                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">クラス</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style="border: 1px solid #cbd5e0; padding: 8px;">001</td>
                                                    <td style="border: 1px solid #cbd5e0; padding: 8px;">田中太郎</td>
                                                    <td style="border: 1px solid #cbd5e0; padding: 8px;">1年A組</td>
                                                </tr>
                                                <tr>
                                                    <td style="border: 1px solid #cbd5e0; padding: 8px;">002</td>
                                                    <td style="border: 1px solid #cbd5e0; padding: 8px;">佐藤花子</td>
                                                    <td style="border: 1px solid #cbd5e0; padding: 8px;">1年B組</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <ul>
                                        <li><strong>行（レコード）</strong>：1件のデータ（1人の生徒の情報）</li>
                                        <li><strong>列（フィールド）</strong>：データの項目（生徒ID、名前など）</li>
                                    </ul>
                                </div>
                            `
                        }
                    ]
                },
                'tables': {
                    title: '🗃️ 第2章：テーブル設計',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>テーブル設計の基本</h3>
                                    <p>良いテーブル設計のポイント：</p>
                                    <ol>
                                        <li><strong>目的を明確にする</strong>：何のデータを管理するか？</li>
                                        <li><strong>必要な項目を洗い出す</strong>：どんな情報が必要か？</li>
                                        <li><strong>データ型を決める</strong>：数値？文字？日付？</li>
                                        <li><strong>制約を考える</strong>：必須項目は？一意性は？</li>
                                    </ol>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>データ型の種類</h3>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div>
                                            <h4>📊 数値型</h4>
                                            <ul>
                                                <li><code>INT</code>：整数（例：123, -45）</li>
                                                <li><code>DECIMAL</code>：小数（例：123.45）</li>
                                            </ul>
                                            <h4>📝 文字型</h4>
                                            <ul>
                                                <li><code>VARCHAR</code>：可変長文字列</li>
                                                <li><code>TEXT</code>：長い文章</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4>📅 日時型</h4>
                                            <ul>
                                                <li><code>DATE</code>：日付（2024-01-01）</li>
                                                <li><code>DATETIME</code>：日時</li>
                                            </ul>
                                            <h4>✅ 論理型</h4>
                                            <ul>
                                                <li><code>BOOLEAN</code>：真偽値（TRUE/FALSE）</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            `
                        }
                    ]
                },
                'keys': {
                    title: '🔑 第3章：主キー・外部キー',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>主キー（Primary Key）</h3>
                                    <p><strong>主キー</strong>は、テーブル内の各行を<span style="color: #4299e1;">一意に識別</span>するための項目です。</p>
                                    <h4>特徴：</h4>
                                    <ul>
                                        <li>🔑 <strong>重複不可</strong>：同じ値を持つ行は存在できない</li>
                                        <li>❌ <strong>NULL不可</strong>：空の値は許可されない</li>
                                        <li>🏷️ <strong>一意識別</strong>：この値があれば特定の行を見つけられる</li>
                                    </ul>
                                    <div style="background: #ebf8ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                        <h4>例：生徒テーブル</h4>
                                        <p><code>生徒ID</code>を主キーにすると、同じIDの生徒は存在できません。</p>
                                    </div>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>外部キー（Foreign Key）</h3>
                                    <p><strong>外部キー</strong>は、<span style="color: #38a169;">他のテーブルの主キーを参照</span>する項目です。</p>
                                    <div style="background: #f0fff4; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                        <h4>例：成績テーブル</h4>
                                        <ul>
                                            <li><code>生徒ID</code>（外部キー）→ 生徒テーブルの主キーを参照</li>
                                            <li><code>科目ID</code>（外部キー）→ 科目テーブルの主キーを参照</li>
                                        </ul>
                                        <p>これにより、<strong>どの生徒の、どの科目の成績か</strong>が分かります！</p>
                                    </div>
                                    <h4>リレーションシップの種類：</h4>
                                    <ul>
                                        <li><strong>一対多</strong>：1人の生徒は複数の成績を持つ</li>
                                        <li><strong>多対多</strong>：多くの生徒が多くの科目を履修</li>
                                    </ul>
                                </div>
                            `
                        }
                    ]
                },
                'normalization': {
                    title: '⚡ 第4章：正規化',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>正規化とは？</h3>
                                    <p><strong>正規化</strong>は、データの<span style="color: #e53e3e;">重複や矛盾を避ける</span>ためのテーブル設計技法です。</p>
                                    <h4>なぜ正規化が必要？</h4>
                                    <div style="background: #fed7d7; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                        <h5>❌ 正規化されていない例</h5>
                                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                            <tr style="background: #e2e8f0;">
                                                <th style="border: 1px solid #cbd5e0; padding: 4px;">生徒名</th>
                                                <th style="border: 1px solid #cbd5e0; padding: 4px;">クラス</th>
                                                <th style="border: 1px solid #cbd5e0; padding: 4px;">担任</th>
                                                <th style="border: 1px solid #cbd5e0; padding: 4px;">科目</th>
                                                <th style="border: 1px solid #cbd5e0; padding: 4px;">点数</th>
                                            </tr>
                                            <tr>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">田中太郎</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">1年A組</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">山田先生</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">数学</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">85</td>
                                            </tr>
                                            <tr>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">田中太郎</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">1年A組</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">山田先生</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">英語</td>
                                                <td style="border: 1px solid #cbd5e0; padding: 4px;">78</td>
                                            </tr>
                                        </table>
                                        <p style="color: #e53e3e; margin-top: 10px;">問題：生徒名、クラス、担任が重複しています！</p>
                                    </div>
                                    <button class="btn btn-secondary" onclick="showNormalizationDemo()">正規化デモを見る</button>
                                </div>
                            `,
                            interactive: 'normalization-demo'
                        }
                    ]
                },
                'er-diagram': {
                    title: '🔗 第5章：ER図',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>ER図とは？</h3>
                                    <p><strong>ER図（Entity Relationship Diagram）</strong>は、データベースの構造を<span style="color: #4299e1;">視覚的に表現</span>する図です。</p>
                                    <h4>🏗️ ER図の構成要素</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div style="background: #ebf8ff; padding: 15px; border-radius: 8px;">
                                            <h5>📦 エンティティ（Entity）</h5>
                                            <ul>
                                                <li>データを格納するオブジェクト</li>
                                                <li>例：生徒、クラス、科目</li>
                                                <li>四角形で表現</li>
                                            </ul>
                                        </div>
                                        <div style="background: #f0fff4; padding: 15px; border-radius: 8px;">
                                            <h5>🔗 リレーションシップ</h5>
                                            <ul>
                                                <li>エンティティ間の関係</li>
                                                <li>例：生徒は科目を履修する</li>
                                                <li>線と菱形で表現</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>ER図の読み方</h3>
                                    <h4>📊 関係性の種類</h4>
                                    <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                        <h5>1️⃣ 一対一（1:1）</h5>
                                        <p>1つのエンティティが、もう1つのエンティティと1対1で対応</p>
                                        <p><strong>例：</strong>1人の生徒は1つの学生証を持つ</p>
                                        
                                        <h5>🔢 一対多（1:N）</h5>
                                        <p>1つのエンティティが、複数のエンティティと関係</p>
                                        <p><strong>例：</strong>1つのクラスには複数の生徒が所属</p>
                                        
                                        <h5>🔀 多対多（M:N）</h5>
                                        <p>複数のエンティティが、複数のエンティティと関係</p>
                                        <p><strong>例：</strong>複数の生徒が複数の科目を履修</p>
                                    </div>
                                    <div style="background: #fffbeb; padding: 15px; border-radius: 8px;">
                                        <h5>💡 実際のER図を見てみよう！</h5>
                                        <p>このツールの「設計モード」に戻って、プリセットのER図を確認してみてください。</p>
                                        <button class="btn" onclick="switchMode('design')">設計モードに切り替え</button>
                                    </div>
                                </div>
                            `
                        }
                    ]
                },
                'sql-basics': {
                    title: '💾 第6章：SQL基礎',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>SQLとは？</h3>
                                    <p><strong>SQL（Structured Query Language）</strong>は、データベースを操作するための<span style="color: #9f7aea;">専用言語</span>です。</p>
                                    <h4>🛠️ 主なSQL文</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div style="background: #e9d8fd; padding: 15px; border-radius: 8px;">
                                            <h5>CREATE TABLE</h5>
                                            <p>新しいテーブルを作成</p>
                                            <code style="background: #fff; padding: 5px; border-radius: 4px; display: block; margin-top: 10px;">
                                                CREATE TABLE students (<br>
                                                &nbsp;&nbsp;id INT PRIMARY KEY,<br>
                                                &nbsp;&nbsp;name VARCHAR(50)<br>
                                                );
                                            </code>
                                        </div>
                                        <div style="background: #fef5e7; padding: 15px; border-radius: 8px;">
                                            <h5>INSERT</h5>
                                            <p>データを挿入</p>
                                            <code style="background: #fff; padding: 5px; border-radius: 4px; display: block; margin-top: 10px;">
                                                INSERT INTO students<br>
                                                VALUES (1, '田中太郎');
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>実際のSQL文を見てみよう</h3>
                                    <p>このツールでは、設計したテーブルから自動的にSQL文を生成できます！</p>
                                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                        <h4>📝 やってみよう</h4>
                                        <ol>
                                            <li>設計モードに切り替える</li>
                                            <li>プリセットを選択してテーブルを作成</li>
                                            <li>「SQL生成」タブでCREATE TABLE文を確認</li>
                                            <li>サンプルデータを追加してINSERT文も確認</li>
                                        </ol>
                                        <button class="btn" onclick="switchMode('design')">設計モードで試してみる</button>
                                    </div>
                                    <div style="background: #c6f6d5; padding: 15px; border-radius: 8px;">
                                        <h5>💡 ポイント</h5>
                                        <ul>
                                            <li>SQL文は英語ベースの命令</li>
                                            <li>大文字・小文字は区別されない（一般的）</li>
                                            <li>セミコロン（;）で文の終わりを示す</li>
                                        </ul>
                                    </div>
                                </div>
                            `
                        }
                    ]
                },
                'practical': {
                    title: '🛠️ 第7章：実践演習',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>実践課題：オリジナルデータベース設計</h3>
                                    <p>これまで学んだ知識を使って、自分でデータベースを設計してみましょう！</p>
                                    <h4>📝 課題</h4>
                                    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                        <p><strong>テーマ：「あなたの趣味を管理するデータベース」</strong></p>
                                        <p>例：</p>
                                        <ul>
                                            <li>📚 読書管理（本、著者、読書記録）</li>
                                            <li>🎮 ゲーム管理（ゲーム、ジャンル、プレイ記録）</li>
                                            <li>🎵 音楽管理（アーティスト、アルバム、曲）</li>
                                            <li>⚽ スポーツ管理（チーム、選手、試合）</li>
                                        </ul>
                                    </div>
                                    <h4>✅ 設計のチェックポイント</h4>
                                    <ol>
                                        <li>主キーが適切に設定されているか？</li>
                                        <li>外部キーでテーブル間の関係が表現されているか？</li>
                                        <li>データ型が適切に選択されているか？</li>
                                        <li>正規化は適切に行われているか？</li>
                                    </ol>
                                    <button class="btn" onclick="switchMode('design')">設計モードで挑戦する</button>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>設計のヒント</h3>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div style="background: #f0fff4; padding: 15px; border-radius: 8px;">
                                            <h5>📖 読書管理の例</h5>
                                            <ul>
                                                <li><strong>本テーブル</strong>：本ID、タイトル、著者ID、ジャンル</li>
                                                <li><strong>著者テーブル</strong>：著者ID、名前、生年月日</li>
                                                <li><strong>読書記録テーブル</strong>：記録ID、本ID、読了日、評価</li>
                                            </ul>
                                        </div>
                                        <div style="background: #fef5e7; padding: 15px; border-radius: 8px;">
                                            <h5>🎮 ゲーム管理の例</h5>
                                            <ul>
                                                <li><strong>ゲームテーブル</strong>：ゲームID、タイトル、ジャンルID、発売日</li>
                                                <li><strong>ジャンルテーブル</strong>：ジャンルID、ジャンル名</li>
                                                <li><strong>プレイ記録テーブル</strong>：記録ID、ゲームID、プレイ時間、クリア状況</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div style="background: #e9d8fd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                                        <h5>🔍 設計完了後は...</h5>
                                        <ol>
                                            <li>サンプルデータを入力してみる</li>
                                            <li>SQL文を生成して確認</li>
                                            <li>設計チェック機能で検証</li>
                                            <li>ER図で関係性を視覚的に確認</li>
                                        </ol>
                                    </div>
                                </div>
                            `
                        }
                    ]
                },
                'review': {
                    title: '📋 第8章：総復習',
                    steps: [
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>🎓 学習内容の振り返り</h3>
                                    <p>これまで学んだ内容を整理してみましょう。</p>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div style="background: #ebf8ff; padding: 15px; border-radius: 8px;">
                                            <h4>📚 基礎知識</h4>
                                            <ul>
                                                <li>✅ データベースとは</li>
                                                <li>✅ テーブル、レコード、フィールド</li>
                                                <li>✅ データ型の種類</li>
                                                <li>✅ 主キー・外部キー</li>
                                            </ul>
                                        </div>
                                        <div style="background: #f0fff4; padding: 15px; border-radius: 8px;">
                                            <h4>🛠️ 実践技術</h4>
                                            <ul>
                                                <li>✅ 正規化技法</li>
                                                <li>✅ ER図の読み書き</li>
                                                <li>✅ SQL文の基礎</li>
                                                <li>✅ 実際の設計演習</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            `
                        },
                        {
                            content: `
                                <div class="lesson-card">
                                    <h3>🚀 次のステップ</h3>
                                    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                        <h4>🎯 テストで理解度チェック</h4>
                                        <p>学習した内容の理解度をテストで確認してみましょう。</p>
                                        <button class="btn" onclick="switchMode('quiz')">テストモードに挑戦</button>
                                    </div>
                                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                        <h4>📈 さらなる学習</h4>
                                        <ul>
                                            <li>より複雑なデータベース設計</li>
                                            <li>SELECT文など他のSQL文</li>
                                            <li>データベース管理システム（DBMS）</li>
                                            <li>パフォーマンス最適化</li>
                                        </ul>
                                    </div>
                                    <div style="background: #c6f6d5; padding: 15px; border-radius: 8px;">
                                        <h4>🎉 お疲れさまでした！</h4>
                                        <p>あなたはデータベースの基礎をマスターしました。</p>
                                        <p>これからもデータベース設計を楽しんでください！</p>
                                    </div>
                                </div>
                            `
                        }
                    ]
                }
            };
        }

        // 正規化デモ表示
        function showNormalizationDemo() {
            document.getElementById('normalizationModal').style.display = 'block';
            showNormalizationStep('unnormalized');
        }

        // 正規化ステップ表示
        function showNormalizationStep(step) {
            const content = document.getElementById('normalizationContent');
            
            switch(step) {
                case 'unnormalized':
                    content.innerHTML = `
                        <div class="normal-form">
                            <h3>❌ 非正規化状態</h3>
                            <p>全ての情報が1つのテーブルに入っています。</p>
                            <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                                <tr style="background: #e2e8f0;">
                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">生徒ID</th>
                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">生徒名</th>
                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">クラス</th>
                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">担任</th>
                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">科目</th>
                                    <th style="border: 1px solid #cbd5e0; padding: 8px;">点数</th>
                                </tr>
                                <tr><td style="border: 1px solid #cbd5e0; padding: 8px;">001</td><td style="border: 1px solid #cbd5e0; padding: 8px;">田中太郎</td><td style="border: 1px solid #cbd5e0; padding: 8px;">1年A組</td><td style="border: 1px solid #cbd5e0; padding: 8px;">山田先生</td><td style="border: 1px solid #cbd5e0; padding: 8px;">数学</td><td style="border: 1px solid #cbd5e0; padding: 8px;">85</td></tr>
                                <tr><td style="border: 1px solid #cbd5e0; padding: 8px;">001</td><td style="border: 1px solid #cbd5e0; padding: 8px;">田中太郎</td><td style="border: 1px solid #cbd5e0; padding: 8px;">1年A組</td><td style="border: 1px solid #cbd5e0; padding: 8px;">山田先生</td><td style="border: 1px solid #cbd5e0; padding: 8px;">英語</td><td style="border: 1px solid #cbd5e0; padding: 8px;">78</td></tr>
                            </table>
                            <div style="background: #fed7d7; padding: 10px; border-radius: 6px;">
                                <strong>問題点：</strong>
                                <ul>
                                    <li>生徒情報が重複している</li>
                                    <li>データの更新が大変</li>
                                    <li>容量の無駄</li>
                                </ul>
                            </div>
                        </div>
                    `;
                    break;
                    
                case '1nf':
                    content.innerHTML = `
                        <div class="normal-form">
                            <h3>✅ 第1正規形（1NF）</h3>
                            <p>各セルには<strong>単一の値</strong>のみを格納します。</p>
                            <div style="background: #c6f6d5; padding: 10px; border-radius: 6px; margin: 10px 0;">
                                <strong>ルール：</strong>
                                <ul>
                                    <li>1つのセルに複数の値を入れない</li>
                                    <li>繰り返しグループを排除</li>
                                </ul>
                            </div>
                            <p>上の例は既に第1正規形を満たしています。</p>
                        </div>
                    `;
                    break;
                    
                case '2nf':
                    content.innerHTML = `
                        <div class="normal-form">
                            <h3>✅ 第2正規形（2NF）</h3>
                            <p><strong>部分関数従属</strong>を排除します。</p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <h4>生徒テーブル</h4>
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr style="background: #e2e8f0;">
                                            <th style="border: 1px solid #cbd5e0; padding: 6px;">生徒ID</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 6px;">生徒名</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 6px;">クラス</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 6px;">担任</th>
                                        </tr>
                                        <tr><td style="border: 1px solid #cbd5e0; padding: 6px;">001</td><td style="border: 1px solid #cbd5e0; padding: 6px;">田中太郎</td><td style="border: 1px solid #cbd5e0; padding: 6px;">1年A組</td><td style="border: 1px solid #cbd5e0; padding: 6px;">山田先生</td></tr>
                                    </table>
                                </div>
                                <div>
                                    <h4>成績テーブル</h4>
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr style="background: #e2e8f0;">
                                            <th style="border: 1px solid #cbd5e0; padding: 6px;">生徒ID</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 6px;">科目</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 6px;">点数</th>
                                        </tr>
                                        <tr><td style="border: 1px solid #cbd5e0; padding: 6px;">001</td><td style="border: 1px solid #cbd5e0; padding: 6px;">数学</td><td style="border: 1px solid #cbd5e0; padding: 6px;">85</td></tr>
                                        <tr><td style="border: 1px solid #cbd5e0; padding: 6px;">001</td><td style="border: 1px solid #cbd5e0; padding: 6px;">英語</td><td style="border: 1px solid #cbd5e0; padding: 6px;">78</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;
                    break;
                    
                case '3nf':
                    content.innerHTML = `
                        <div class="normal-form">
                            <h3>✅ 第3正規形（3NF）</h3>
                            <p><strong>推移関数従属</strong>を排除します。</p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <div>
                                    <h4>生徒テーブル</h4>
                                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                        <tr style="background: #e2e8f0;">
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">生徒ID</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">生徒名</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">クラスID</th>
                                        </tr>
                                        <tr><td style="border: 1px solid #cbd5e0; padding: 4px;">001</td><td style="border: 1px solid #cbd5e0; padding: 4px;">田中太郎</td><td style="border: 1px solid #cbd5e0; padding: 4px;">A01</td></tr>
                                    </table>
                                </div>
                                <div>
                                    <h4>クラステーブル</h4>
                                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                        <tr style="background: #e2e8f0;">
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">クラスID</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">クラス名</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">担任</th>
                                        </tr>
                                        <tr><td style="border: 1px solid #cbd5e0; padding: 4px;">A01</td><td style="border: 1px solid #cbd5e0; padding: 4px;">1年A組</td><td style="border: 1px solid #cbd5e0; padding: 4px;">山田先生</td></tr>
                                    </table>
                                </div>
                                <div>
                                    <h4>成績テーブル</h4>
                                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                        <tr style="background: #e2e8f0;">
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">生徒ID</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">科目</th>
                                            <th style="border: 1px solid #cbd5e0; padding: 4px;">点数</th>
                                        </tr>
                                        <tr><td style="border: 1px solid #cbd5e0; padding: 4px;">001</td><td style="border: 1px solid #cbd5e0; padding: 4px;">数学</td><td style="border: 1px solid #cbd5e0; padding: 4px;">85</td></tr>
                                    </table>
                                </div>
                            </div>
                            <div style="background: #c6f6d5; padding: 10px; border-radius: 6px; margin: 10px 0;">
                                <strong>✅ 正規化完了！</strong>
                                <ul>
                                    <li>データの重複が解消</li>
                                    <li>更新異常の防止</li>
                                    <li>効率的なデータ管理</li>
                                </ul>
                            </div>
                        </div>
                    `;
                    break;
            }
        }

        // テスト開始
        function startQuiz(quizId) {
            currentQuiz = quizId;
            currentQuizIndex = 0;
            quizAnswers = [];
            
            const quizData = getQuizQuestions();
            quizQuestions = quizData[quizId] || [];
            
            if (quizQuestions.length === 0) {
                alert('このテストはまだ準備中です。');
                return;
            }
            
            document.getElementById('quizTitle').textContent = getQuizTitle(quizId);
            showQuizQuestion();
            document.getElementById('quizModal').style.display = 'block';
        }

        // テストタイトル取得
        function getQuizTitle(quizId) {
            const titles = {
                'basic-concepts': '📚 基礎概念テスト',
                'table-design': '🏗️ テーブル設計テスト',
                'relationships': '🔗 リレーションシップテスト',
                'normalization': '⚡ 正規化テスト',
                'er-diagrams': '📊 ER図読解テスト',
                'comprehensive': '🎯 総合テスト'
            };
            return titles[quizId] || 'テスト';
        }

        // テスト問題表示
        function showQuizQuestion() {
            const question = quizQuestions[currentQuizIndex];
            const container = document.getElementById('quizQuestionContainer');
            
            document.getElementById('quizProgress').textContent = 
                `問題 ${currentQuizIndex + 1}/${quizQuestions.length}`;
            
            container.innerHTML = `
                <div class="quiz-question">
                    <h3>問題 ${currentQuizIndex + 1}</h3>
                    <p>${question.question}</p>
                    <div class="quiz-options">
                        ${question.options.map((option, index) => `
                            <div class="quiz-option" onclick="selectQuizOption(${index})" data-option="${index}">
                                ${String.fromCharCode(65 + index)}. ${option}
                            </div>
                        `).join('')}
                    </div>
                    ${question.explanation ? `
                        <div id="explanation" style="display: none; background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <h4 style="color: #1e40af;">解説</h4>
                            <p>${question.explanation}</p>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // ボタンの表示制御
            document.getElementById('prevQuizBtn').style.display = 
                currentQuizIndex > 0 ? 'inline-block' : 'none';
            document.getElementById('nextQuizBtn').style.display = 
                currentQuizIndex < quizQuestions.length - 1 ? 'inline-block' : 'none';
            document.getElementById('submitQuizBtn').style.display = 
                currentQuizIndex === quizQuestions.length - 1 ? 'inline-block' : 'none';
            document.getElementById('retryQuizBtn').style.display = 'none';
        }

        // 選択肢選択
        function selectQuizOption(optionIndex) {
            // 既存の選択をクリア
            document.querySelectorAll('.quiz-option').forEach(opt => 
                opt.classList.remove('selected'));
            
            // 新しい選択をマーク
            document.querySelector(`[data-option="${optionIndex}"]`).classList.add('selected');
            
            // 回答を記録
            quizAnswers[currentQuizIndex] = optionIndex;
        }

        // 次の問題
        function nextQuestion() {
            if (currentQuizIndex < quizQuestions.length - 1) {
                currentQuizIndex++;
                showQuizQuestion();
                
                // 前の回答があれば復元
                if (quizAnswers[currentQuizIndex] !== undefined) {
                    setTimeout(() => {
                        document.querySelector(`[data-option="${quizAnswers[currentQuizIndex]}"]`)?.classList.add('selected');
                    }, 100);
                }
            }
        }

        // 前の問題
        function previousQuestion() {
            if (currentQuizIndex > 0) {
                currentQuizIndex--;
                showQuizQuestion();
                
                // 前の回答があれば復元
                if (quizAnswers[currentQuizIndex] !== undefined) {
                    setTimeout(() => {
                        document.querySelector(`[data-option="${quizAnswers[currentQuizIndex]}"]`)?.classList.add('selected');
                    }, 100);
                }
            }
        }

        // テスト提出
        function submitQuiz() {
            // 採点
            let correct = 0;
            quizQuestions.forEach((question, index) => {
                if (quizAnswers[index] === question.correct) {
                    correct++;
                }
            });
            
            const score = Math.round((correct / quizQuestions.length) * 100);
            quizScores[currentQuiz] = score;
            
            // 結果表示
            showQuizResults(correct, score);
            
            // 進捗更新・保存
            updateQuizProgress();
            saveToStorage();
        }

        // テスト結果表示
        function showQuizResults(correct, score) {
            const container = document.getElementById('quizQuestionContainer');
            const total = quizQuestions.length;
            
            let resultColor = '#e53e3e'; // 赤
            let resultText = '不合格';
            let resultEmoji = '😔';
            
            if (score >= 80) {
                resultColor = '#38a169'; // 緑
                resultText = '優秀！';
                resultEmoji = '🎉';
            } else if (score >= 70) {
                resultColor = '#38a169'; // 緑
                resultText = '合格！';
                resultEmoji = '✅';
            } else if (score >= 50) {
                resultColor = '#f6ad55'; // オレンジ
                resultText = 'もう少し！';
                resultEmoji = '📚';
            }
            
            container.innerHTML = `
                <div class="quiz-question" style="text-align: center;">
                    <h2 style="color: ${resultColor};">${resultEmoji} テスト結果</h2>
                    <div style="font-size: 48px; color: ${resultColor}; margin: 20px 0;">${score}点</div>
                    <h3 style="color: ${resultColor};">${resultText}</h3>
                    <p style="font-size: 18px; margin: 20px 0;">
                        ${correct}問正解 / ${total}問中
                    </p>
                    <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h4>詳細結果</h4>
                        ${quizQuestions.map((question, index) => {
                            const isCorrect = quizAnswers[index] === question.correct;
                            const userAnswer = quizAnswers[index] !== undefined ? 
                                String.fromCharCode(65 + quizAnswers[index]) : '未回答';
                            const correctAnswer = String.fromCharCode(65 + question.correct);
                            
                            return `
                                <div style="margin: 10px 0; padding: 10px; background: ${isCorrect ? '#c6f6d5' : '#fed7d7'}; border-radius: 6px;">
                                    <strong>問題${index + 1}</strong>: 
                                    ${isCorrect ? '✅' : '❌'} 
                                    あなたの回答: ${userAnswer} 
                                    ${!isCorrect ? `(正解: ${correctAnswer})` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            
            // ボタンの表示制御
            document.getElementById('prevQuizBtn').style.display = 'none';
            document.getElementById('nextQuizBtn').style.display = 'none';
            document.getElementById('submitQuizBtn').style.display = 'none';
            document.getElementById('retryQuizBtn').style.display = 'inline-block';
        }

        // テスト再挑戦
        function retryQuiz() {
            currentQuizIndex = 0;
            quizAnswers = [];
            showQuizQuestion();
        }

        // テスト問題データ
        function getQuizQuestions() {
            return {
                'basic-concepts': [
                    {
                        question: "データベースの主な目的として最も適切なものはどれですか？",
                        options: [
                            "データを美しく表示すること",
                            "データを効率的に格納・管理すること", 
                            "プログラムを高速化すること",
                            "ウェブサイトを作成すること"
                        ],
                        correct: 1,
                        explanation: "データベースの主な目的は、データを効率的に格納・管理し、必要な時に素早く取り出せるようにすることです。"
                    },
                    {
                        question: "リレーショナルデータベースでデータを格納する基本単位は何ですか？",
                        options: ["ファイル", "テーブル", "フォルダ", "ドキュメント"],
                        correct: 1,
                        explanation: "リレーショナルデータベースでは、データをテーブル（表）という形式で格納します。"
                    },
                    {
                        question: "テーブルの「行」は何と呼ばれますか？",
                        options: ["フィールド", "カラム", "レコード", "セル"],
                        correct: 2,
                        explanation: "テーブルの行は「レコード」と呼ばれ、1つのデータエンティティ（例：1人の生徒の情報）を表します。"
                    },
                    {
                        question: "テーブルの「列」は何と呼ばれますか？",
                        options: ["レコード", "フィールド", "データ", "エンティティ"],
                        correct: 1,
                        explanation: "テーブルの列は「フィールド」と呼ばれ、データの項目（例：名前、年齢など）を表します。"
                    },
                    {
                        question: "データベース管理システムの略称として正しいものはどれですか？",
                        options: ["DMS", "DBMS", "DBS", "BDMS"],
                        correct: 1,
                        explanation: "DBMS（Database Management System）はデータベース管理システムの略称です。"
                    },
                    {
                        question: "リレーショナルデータベースの特徴として正しくないものはどれですか？",
                        options: [
                            "データを表形式で管理する",
                            "テーブル間の関係を定義できる",
                            "データは階層構造で格納される",
                            "SQLでデータを操作する"
                        ],
                        correct: 2,
                        explanation: "リレーショナルデータベースは階層構造ではなく、関係モデルに基づいてデータを管理します。"
                    },
                    {
                        question: "データベースを使用しない場合の問題点として正しくないものはどれですか？",
                        options: [
                            "データの重複が発生しやすい",
                            "データの整合性を保つのが困難",
                            "データの検索速度が向上する",
                            "データの共有が難しい"
                        ],
                        correct: 2,
                        explanation: "データベースを使用しない場合、検索速度は遅くなります。データベースを使うことで検索速度が向上します。"
                    },
                    {
                        question: "データの「整合性」とは何を意味しますか？",
                        options: [
                            "データの処理速度が速いこと",
                            "データに矛盾や不整合がないこと",
                            "データの容量が小さいこと",
                            "データの暗号化が行われていること"
                        ],
                        correct: 1,
                        explanation: "データの整合性とは、データに矛盾や不整合がなく、正確で一貫した状態を保つことです。"
                    },
                    {
                        question: "スキーマ（Schema）とは何ですか？",
                        options: [
                            "データベース内の実際のデータ",
                            "データベースの構造や設計図",
                            "データを検索するためのコマンド",
                            "データのバックアップファイル"
                        ],
                        correct: 1,
                        explanation: "スキーマはデータベースの構造や設計図を表し、テーブルの定義や関係性などを含みます。"
                    },
                    {
                        question: "トランザクションの概念として正しいものはどれですか？",
                        options: [
                            "データベースの検索処理",
                            "データの一連の処理をまとめた作業単位",
                            "テーブル間の関係性",
                            "データの暗号化処理"
                        ],
                        correct: 1,
                        explanation: "トランザクションは、データベースに対する一連の処理をまとめた作業単位で、全て成功するか全て失敗するかのどちらかになります。"
                    }
                ],
                'table-design': [
                    {
                        question: "整数を格納するのに適したデータ型はどれですか？",
                        options: ["VARCHAR", "INT", "TEXT", "DATE"],
                        correct: 1,
                        explanation: "INTは整数（Integer）を格納するためのデータ型です。"
                    },
                    {
                        question: "生徒の名前を格納するのに最も適したデータ型はどれですか？",
                        options: ["INT", "DATE", "VARCHAR", "BOOLEAN"],
                        correct: 2,
                        explanation: "VARCHAR（可変長文字列）は名前のような文字データの格納に適しています。"
                    },
                    {
                        question: "日付を格納するデータ型はどれですか？",
                        options: ["VARCHAR", "INT", "DATE", "TEXT"],
                        correct: 2,
                        explanation: "DATEは日付（年-月-日）を格納するためのデータ型です。"
                    },
                    {
                        question: "真偽値（true/false）を格納するデータ型はどれですか？",
                        options: ["BOOLEAN", "INT", "VARCHAR", "DATE"],
                        correct: 0,
                        explanation: "BOOLEANは真偽値（TRUE/FALSE）を格納するためのデータ型です。"
                    },
                    {
                        question: "小数点を含む数値を格納するのに適したデータ型はどれですか？",
                        options: ["INT", "DECIMAL", "VARCHAR", "TEXT"],
                        correct: 1,
                        explanation: "DECIMAL（またはFLOAT）は小数点を含む数値を格納するためのデータ型です。"
                    },
                    {
                        question: "長い文章やコメントを格納するのに適したデータ型はどれですか？",
                        options: ["INT", "VARCHAR(50)", "TEXT", "DATE"],
                        correct: 2,
                        explanation: "TEXTは長い文章や制限のない文字列を格納するのに適しています。"
                    },
                    {
                        question: "テーブル設計で「制約」の役割として正しいものはどれですか？",
                        options: [
                            "データの表示順序を決める",
                            "データの正確性を保証する",
                            "データの暗号化を行う",
                            "データの圧縮を行う"
                        ],
                        correct: 1,
                        explanation: "制約は、データベースに格納されるデータの正確性と整合性を保証する役割があります。"
                    },
                    {
                        question: "NULL値について正しい説明はどれですか？",
                        options: [
                            "0（ゼロ）と同じ意味",
                            "空の文字列と同じ意味",
                            "値が存在しないことを表す",
                            "エラーを表す特別な値"
                        ],
                        correct: 2,
                        explanation: "NULL値は「値が存在しない」ことを表す特別な値で、0や空文字列とは異なります。"
                    },
                    {
                        question: "VARCHAR(50)の意味として正しいものはどれですか？",
                        options: [
                            "固定長50文字の文字列",
                            "最大50文字の可変長文字列",
                            "50個のデータを格納できる",
                            "50行のデータを表す"
                        ],
                        correct: 1,
                        explanation: "VARCHAR(50)は最大50文字まで格納できる可変長文字列を表します。"
                    },
                    {
                        question: "テーブル設計における「正規化」の利点として正しくないものはどれですか？",
                        options: [
                            "データの重複を減らす",
                            "データの整合性を保つ",
                            "検索処理を必ず高速化する",
                            "更新異常を防ぐ"
                        ],
                        correct: 2,
                        explanation: "正規化は必ずしも検索処理を高速化するとは限りません。場合によっては結合処理により処理が重くなることもあります。"
                    }
                ],
                'relationships': [
                    {
                        question: "主キーの特徴として正しくないものはどれですか？",
                        options: [
                            "値が重複してはいけない",
                            "NULL値を持つことができる",
                            "テーブル内の各行を一意に識別する",
                            "必須項目である"
                        ],
                        correct: 1,
                        explanation: "主キーはNULL値を持つことができません。必ず値が入っている必要があります。"
                    },
                    {
                        question: "外部キーの役割として最も適切なものはどれですか？",
                        options: [
                            "データを暗号化する",
                            "他のテーブルとの関係を表現する",
                            "データの並び順を決める",
                            "データを圧縮する"
                        ],
                        correct: 1,
                        explanation: "外部キーは他のテーブルの主キーを参照することで、テーブル間の関係性を表現します。"
                    },
                    {
                        question: "複合主キーとは何ですか？",
                        options: [
                            "2つ以上のフィールドを組み合わせた主キー",
                            "暗号化された主キー",
                            "自動的に生成される主キー",
                            "文字列と数値を組み合わせた主キー"
                        ],
                        correct: 0,
                        explanation: "複合主キーは、2つ以上のフィールドを組み合わせて一意性を保つ主キーです。"
                    },
                    {
                        question: "参照整合性制約の目的として正しいものはどれですか？",
                        options: [
                            "データの暗号化を強制する",
                            "外部キーが参照先に存在することを保証する",
                            "データの処理速度を向上させる",
                            "データの圧縮率を高める"
                        ],
                        correct: 1,
                        explanation: "参照整合性制約は、外部キーの値が参照先テーブルに必ず存在することを保証します。"
                    },
                    {
                        question: "一対多（1:N）の関係の例として適切でないものはどれですか？",
                        options: [
                            "1つの部署に複数の社員が所属",
                            "1人の顧客が複数の注文を行う",
                            "1人の学生が1つの学生証を持つ",
                            "1つのカテゴリに複数の商品が属する"
                        ],
                        correct: 2,
                        explanation: "1人の学生が1つの学生証を持つのは一対一（1:1）の関係です。"
                    },
                    {
                        question: "多対多（M:N）の関係を実現するために使用するものはどれですか？",
                        options: [
                            "主キー",
                            "外部キー",
                            "中間テーブル（連関テーブル）",
                            "インデックス"
                        ],
                        correct: 2,
                        explanation: "多対多の関係は中間テーブル（連関テーブル）を使用して実現します。"
                    },
                    {
                        question: "外部キー制約違反が発生する場合として正しいものはどれですか？",
                        options: [
                            "主キーに同じ値を挿入しようとした時",
                            "存在しない参照先を外部キーに設定した時",
                            "NULL値を必須フィールドに挿入した時",
                            "文字列を数値フィールドに挿入した時"
                        ],
                        correct: 1,
                        explanation: "外部キーに存在しない参照先を設定しようとすると、参照整合性制約違反が発生します。"
                    },
                    {
                        question: "カーディナリティ（Cardinality）とは何を表しますか？",
                        options: [
                            "テーブルのサイズ",
                            "データの精度",
                            "関係に参加するエンティティの数",
                            "処理の実行時間"
                        ],
                        correct: 2,
                        explanation: "カーディナリティは関係に参加するエンティティの数を表し、一対一、一対多、多対多などの関係性を示します。"
                    },
                    {
                        question: "自己参照外部キーの例として適切なものはどれですか？",
                        options: [
                            "社員テーブルの上司ID（同じ社員テーブルの社員IDを参照）",
                            "注文テーブルの顧客ID（顧客テーブルの顧客IDを参照）",
                            "商品テーブルのカテゴリID（カテゴリテーブルのカテゴリIDを参照）",
                            "成績テーブルの生徒ID（生徒テーブルの生徒IDを参照）"
                        ],
                        correct: 0,
                        explanation: "自己参照外部キーは同じテーブル内の他のレコードを参照する外部キーで、社員の上司関係などが典型例です。"
                    },
                    {
                        question: "リレーションシップでの「依存関係」について正しい説明はどれですか？",
                        options: [
                            "親テーブルが削除されると子テーブルも自動削除される",
                            "子テーブルのレコードが親テーブルの存在に依存する",
                            "テーブル間でデータが同期される",
                            "関連するテーブルが同時に更新される"
                        ],
                        correct: 1,
                        explanation: "依存関係では、子テーブルのレコードは親テーブルの対応するレコードの存在に依存します。"
                    }
                ],
                'normalization': [
                    {
                        question: "正規化の主な目的は何ですか？",
                        options: [
                            "データの処理速度を上げる",
                            "データの重複と矛盾を防ぐ",
                            "データベースサイズを小さくする",
                            "セキュリティを向上させる"
                        ],
                        correct: 1,
                        explanation: "正規化の主な目的は、データの重複と矛盾を防ぎ、データの整合性を保つことです。"
                    },
                    {
                        question: "第3正規形の条件として正しいものはどれですか？",
                        options: [
                            "すべてのフィールドが主キーに依存する",
                            "推移関数従属を排除する",
                            "複数値属性を排除する",
                            "部分関数従属を排除する"
                        ],
                        correct: 1,
                        explanation: "第3正規形では推移関数従属を排除します。つまり、主キー以外のフィールドに依存するフィールドを別テーブルに分離します。"
                    },
                    {
                        question: "第1正規形（1NF）の条件として正しいものはどれですか？",
                        options: [
                            "部分関数従属を排除する",
                            "推移関数従属を排除する",
                            "各フィールドが単一の値を持つ",
                            "外部キーを設定する"
                        ],
                        correct: 2,
                        explanation: "第1正規形では、各フィールドが原子的（分割できない単一の値）である必要があります。"
                    },
                    {
                        question: "第2正規形（2NF）で排除すべきものは何ですか？",
                        options: [
                            "推移関数従属",
                            "部分関数従属",
                            "多値属性",
                            "NULL値"
                        ],
                        correct: 1,
                        explanation: "第2正規形では部分関数従属を排除します。つまり、主キーの一部にのみ依存する属性を別テーブルに分離します。"
                    },
                    {
                        question: "正規化のメリットとして正しくないものはどれですか？",
                        options: [
                            "更新異常の防止",
                            "削除異常の防止",
                            "必ず検索処理が高速化される",
                            "データの一貫性向上"
                        ],
                        correct: 2,
                        explanation: "正規化により結合処理が増える場合があり、必ずしも検索処理が高速化されるとは限りません。"
                    },
                    {
                        question: "関数従属とは何ですか？",
                        options: [
                            "テーブル間の参照関係",
                            "ある属性の値が決まると別の属性の値も決まる関係",
                            "主キーと外部キーの関係",
                            "データ型間の変換関係"
                        ],
                        correct: 1,
                        explanation: "関数従属とは、ある属性（またはその組み合わせ）の値が決まると、別の属性の値も一意に決まる関係です。"
                    },
                    {
                        question: "非正規化を行う理由として最も適切なものはどれですか？",
                        options: [
                            "データの整合性を向上させる",
                            "検索処理のパフォーマンスを向上させる",
                            "ストレージ容量を削減する",
                            "セキュリティを強化する"
                        ],
                        correct: 1,
                        explanation: "非正規化は、検索処理の高速化を目的として意図的に正規化を緩める設計手法です。"
                    },
                    {
                        question: "ボイス・コッド正規形（BCNF）の特徴として正しいものはどれですか？",
                        options: [
                            "第2正規形より緩い条件",
                            "第3正規形より厳しい条件",
                            "第1正規形と同じ条件",
                            "外部キー制約を含む"
                        ],
                        correct: 1,
                        explanation: "ボイス・コッド正規形（BCNF）は第3正規形よりも厳しい条件を課した正規形です。"
                    }
                ],
                'er-diagrams': [
                    {
                        question: "ER図で「一対多」の関係を表すのに適切な例はどれですか？",
                        options: [
                            "1人の生徒は1つの学生証を持つ",
                            "1つのクラスには複数の生徒が所属する",
                            "複数の生徒が複数の科目を履修する",
                            "1つの図書館には1人の館長がいる"
                        ],
                        correct: 1,
                        explanation: "1つのクラスには複数の生徒が所属するという関係は、典型的な一対多（1:N）の関係です。"
                    },
                    {
                        question: "ER図でエンティティを表すのに使われる図形は何ですか？",
                        options: ["円", "四角形", "菱形", "三角形"],
                        correct: 1,
                        explanation: "ER図では、エンティティ（実体）は四角形で表現されます。"
                    },
                    {
                        question: "ER図でリレーションシップ（関係）を表すのに使われる図形は何ですか？",
                        options: ["円", "四角形", "菱形", "三角形"],
                        correct: 2,
                        explanation: "ER図では、リレーションシップ（関係）は菱形で表現されます。"
                    },
                    {
                        question: "ER図で属性（アトリビュート）を表すのに使われる図形は何ですか？",
                        options: ["円", "四角形", "菱形", "三角形"],
                        correct: 0,
                        explanation: "ER図では、属性（アトリビュート）は円（楕円）で表現されます。"
                    },
                    {
                        question: "ER図で「多対多」の関係の例として適切なものはどれですか？",
                        options: [
                            "1人の生徒は1つの学生証を持つ",
                            "1つのクラスには複数の生徒が所属する",
                            "複数の生徒が複数の科目を履修する",
                            "1つの会社には1人の社長がいる"
                        ],
                        correct: 2,
                        explanation: "複数の生徒が複数の科目を履修するという関係は、多対多（M:N）の関係です。"
                    },
                    {
                        question: "弱いエンティティとは何ですか？",
                        options: [
                            "属性が少ないエンティティ",
                            "他のエンティティに依存して存在するエンティティ",
                            "データが少ないエンティティ",
                            "重要度が低いエンティティ"
                        ],
                        correct: 1,
                        explanation: "弱いエンティティは、他のエンティティ（強いエンティティ）に依存して存在し、単独では意味を持たないエンティティです。"
                    },
                    {
                        question: "ER図における「カーディナリティ」とは何を表しますか？",
                        options: [
                            "エンティティの重要度",
                            "関係に参加するエンティティの数",
                            "属性の数",
                            "データの品質"
                        ],
                        correct: 1,
                        explanation: "カーディナリティは関係に参加するエンティティの数を表し、1:1、1:N、M:Nなどで表現されます。"
                    },
                    {
                        question: "ER図から関係データベースのテーブル設計を行う際、多対多の関係はどのように実現しますか？",
                        options: [
                            "外部キーを使用する",
                            "主キーを複製する",
                            "中間テーブル（連関テーブル）を作成する",
                            "ビューを作成する"
                        ],
                        correct: 2,
                        explanation: "多対多の関係は、両方のエンティティの主キーを外部キーとして持つ中間テーブル（連関テーブル）を作成して実現します。"
                    }
                ],
                'comprehensive': [
                    {
                        question: "データベースで最も基本的なデータ格納単位は何ですか？",
                        options: ["データベース", "テーブル", "ビュー", "インデックス"],
                        correct: 1,
                        explanation: "リレーショナルデータベースでは、テーブルが最も基本的なデータ格納単位です。"
                    },
                    {
                        question: "主キーの制約として正しくないものはどれですか？",
                        options: [
                            "一意性（ユニーク）",
                            "非NULL制約",
                            "外部キー参照",
                            "テーブルごとに1つ以上必要"
                        ],
                        correct: 2,
                        explanation: "主キーは外部キーを参照するものではありません。外部キーが主キーを参照します。"
                    },
                    {
                        question: "正規化を行う主な理由として最も適切なものはどれですか？",
                        options: [
                            "検索速度を向上させる",
                            "データの冗長性を排除する",
                            "セキュリティを強化する",
                            "ストレージ容量を削減する"
                        ],
                        correct: 1,
                        explanation: "正規化の主な目的は、データの冗長性（重複）を排除し、データの整合性を保つことです。"
                    },
                    {
                        question: "SQL言語のDDL（Data Definition Language）に含まれるコマンドはどれですか？",
                        options: ["SELECT", "INSERT", "CREATE TABLE", "UPDATE"],
                        correct: 2,
                        explanation: "CREATE TABLEはDDL（データ定義言語）のコマンドで、データベースの構造を定義します。"
                    },
                    {
                        question: "データベースの「整合性」とは何を意味しますか？",
                        options: [
                            "データの処理速度",
                            "データの正確性と一貫性",
                            "データの暗号化レベル",
                            "データの圧縮率"
                        ],
                        correct: 1,
                        explanation: "データベースの整合性とは、データが正確で一貫性があり、定められた制約を満たしている状態を意味します。"
                    },
                    {
                        question: "ER図で「弱いエンティティ」はどのような線で囲まれますか？",
                        options: ["実線", "点線", "二重線", "波線"],
                        correct: 2,
                        explanation: "弱いエンティティは二重線の四角形で表現されます。"
                    },
                    {
                        question: "データベース設計における「候補キー」とは何ですか？",
                        options: [
                            "主キーになる可能性のある属性の組み合わせ",
                            "外部キーの候補",
                            "インデックスの候補",
                            "削除予定の属性"
                        ],
                        correct: 0,
                        explanation: "候補キーは、テーブル内の各行を一意に識別できる属性または属性の組み合わせで、主キーになる可能性があります。"
                    },
                    {
                        question: "第2正規形において排除される「部分関数従属」とは何ですか？",
                        options: [
                            "主キーの一部分に依存する属性",
                            "外部キーに依存する属性",
                            "NULL値を含む属性",
                            "複数値を持つ属性"
                        ],
                        correct: 0,
                        explanation: "部分関数従属とは、複合主キーの一部分にのみ依存する属性のことです。"
                    },
                    {
                        question: "SQLのJOIN操作の主な目的は何ですか？",
                        options: [
                            "データを削除する",
                            "複数のテーブルのデータを結合する",
                            "データを暗号化する",
                            "インデックスを作成する"
                        ],
                        correct: 1,
                        explanation: "JOIN操作は、複数のテーブルからデータを組み合わせて取得するために使用されます。"
                    },
                    {
                        question: "データベースの「スキーマ」とは何を指しますか？",
                        options: [
                            "データベースのバックアップ",
                            "データベースの構造定義",
                            "データベースのパスワード",
                            "データベースのサイズ"
                        ],
                        correct: 1,
                        explanation: "スキーマは、データベースの論理的な構造を定義したもので、テーブル、フィールド、関係などを含みます。"
                    },
                    {
                        question: "一対一（1:1）関係をテーブル設計で実現する最も一般的な方法はどれですか？",
                        options: [
                            "中間テーブルを作成",
                            "片方のテーブルにもう片方の主キーを外部キーとして追加",
                            "両方のテーブルを統合",
                            "ビューを作成"
                        ],
                        correct: 1,
                        explanation: "一対一関係は、一方のテーブルに他方の主キーを一意な外部キーとして追加することで実現できます。"
                    },
                    {
                        question: "データベースにおける「トランザクション」の特性で「ACID」に含まれないものはどれですか？",
                        options: ["Atomicity（原子性）", "Consistency（一貫性）", "Isolation（独立性）", "Availability（可用性）"],
                        correct: 3,
                        explanation: "ACIDはAtomicity、Consistency、Isolation、Durability（永続性）を指し、Availabilityは含まれません。"
                    },
                    {
                        question: "外部キー制約の「CASCADE DELETE」とは何ですか？",
                        options: [
                            "親レコードが削除されたとき子レコードも自動削除",
                            "子レコードが削除されたとき親レコードも自動削除",
                            "削除操作を禁止する",
                            "削除時にNULLを設定する"
                        ],
                        correct: 0,
                        explanation: "CASCADE DELETEは、参照される親レコードが削除されたとき、それを参照する子レコードも自動的に削除する制約です。"
                    },
                    {
                        question: "データベース設計で「非正規化」を行う主な理由はどれですか？",
                        options: [
                            "データの整合性を向上させる",
                            "ストレージ容量を削減する",
                            "クエリのパフォーマンスを向上させる",
                            "セキュリティを強化する"
                        ],
                        correct: 2,
                        explanation: "非正規化は、JOIN操作を減らしてクエリのパフォーマンスを向上させることを目的として行われます。"
                    },
                    {
                        question: "学校システムで「生徒」「科目」「成績」の関係を正しく表現した設計はどれですか？",
                        options: [
                            "生徒テーブルに全科目の成績列を追加",
                            "科目テーブルに全生徒の成績列を追加",
                            "生徒IDと科目IDを外部キーとする成績テーブルを作成",
                            "成績テーブルに生徒名と科目名を直接格納"
                        ],
                        correct: 2,
                        explanation: "生徒と科目の多対多関係は、両者のIDを外部キーとする成績テーブル（中間テーブル）で正しく表現できます。"
                    }
                ]
            };
        }

        // SQL実行モード関連機能
        let currentSQLDataset = null;
        let sqlSampleData = {};

        // SQL実行モード初期化
        function initializeSQLMode() {
            console.log('SQL実行モードを初期化しました');
            if (!currentSQLDataset) {
                document.getElementById('sqlResults').innerHTML = '<p style="text-align: center; color: #718096;">まずプリセットを選択してデータを読み込んでください</p>';
            }
        }

        // SQLプリセット読み込み
        function loadSQLPreset(presetType) {
            currentSQLDataset = presetType;
            
            // プリセットデータを設定
            setupSQLSampleData(presetType);
            
            // テーブルデータプレビューを更新
            displayTableDataPreview();
            
            // 入力エリアにサンプルクエリを設定
            setSampleQuery(presetType);
        }

        // サンプルデータ設定
        function setupSQLSampleData(presetType) {
            if (presetType === 'school') {
                sqlSampleData = {
                    students: [
                        {id: 1, name: '田中太郎', grade: '1年', class: 'A組', age: 16},
                        {id: 2, name: '佐藤花子', grade: '1年', class: 'B組', age: 15},
                        {id: 3, name: '鈴木一郎', grade: '2年', class: 'A組', age: 17},
                        {id: 4, name: '高橋美咲', grade: '2年', class: 'B組', age: 16},
                        {id: 5, name: '伊藤健太', grade: '3年', class: 'A組', age: 18}
                    ],
                    subjects: [
                        {id: 1, name: '数学', teacher: '山田先生', credits: 3},
                        {id: 2, name: '英語', teacher: '田村先生', credits: 4},
                        {id: 3, name: '国語', teacher: '佐々木先生', credits: 4},
                        {id: 4, name: '理科', teacher: '中村先生', credits: 2}
                    ],
                    grades: [
                        {id: 1, student_id: 1, subject_id: 1, score: 85},
                        {id: 2, student_id: 1, subject_id: 2, score: 92},
                        {id: 3, student_id: 2, subject_id: 1, score: 78},
                        {id: 4, student_id: 2, subject_id: 3, score: 88},
                        {id: 5, student_id: 3, subject_id: 1, score: 95},
                        {id: 6, student_id: 3, subject_id: 4, score: 82}
                    ]
                };
            } else if (presetType === 'library') {
                sqlSampleData = {
                    books: [
                        {id: 1, title: 'データベース入門', author: '情報太郎', isbn: '978-1234567890', category: 'IT'},
                        {id: 2, title: 'プログラミング基礎', author: '開発花子', isbn: '978-1234567891', category: 'IT'},
                        {id: 3, title: '日本の歴史', author: '歴史一郎', isbn: '978-1234567892', category: '歴史'},
                        {id: 4, title: '英語入門', author: '言語美咲', isbn: '978-1234567893', category: '語学'}
                    ],
                    users: [
                        {id: 1, name: '図書太郎', email: 'tosho@example.com', membership_type: '一般'},
                        {id: 2, name: '読書花子', email: 'dokusho@example.com', membership_type: '学生'},
                        {id: 3, name: '学習一郎', email: 'gakushu@example.com', membership_type: '教員'}
                    ],
                    loans: [
                        {id: 1, user_id: 1, book_id: 1, loan_date: '2024-01-15', return_date: null},
                        {id: 2, user_id: 2, book_id: 2, loan_date: '2024-01-10', return_date: '2024-01-25'},
                        {id: 3, user_id: 3, book_id: 3, loan_date: '2024-01-20', return_date: null}
                    ]
                };
            } else if (presetType === 'ecommerce') {
                sqlSampleData = {
                    products: [
                        {id: 1, name: 'ノートパソコン', price: 89800, category: '電子機器', stock: 15},
                        {id: 2, name: 'マウス', price: 2980, category: '電子機器', stock: 50},
                        {id: 3, name: 'キーボード', price: 5980, category: '電子機器', stock: 30},
                        {id: 4, name: 'モニター', price: 24800, category: '電子機器', stock: 8}
                    ],
                    customers: [
                        {id: 1, name: '購入太郎', email: 'konyuu@example.com', city: '東京都'},
                        {id: 2, name: '買物花子', email: 'kaimono@example.com', city: '大阪府'},
                        {id: 3, name: '注文一郎', email: 'chumon@example.com', city: '名古屋市'}
                    ],
                    orders: [
                        {id: 1, customer_id: 1, product_id: 1, quantity: 1, order_date: '2024-01-15'},
                        {id: 2, customer_id: 2, product_id: 2, quantity: 2, order_date: '2024-01-16'},
                        {id: 3, customer_id: 1, product_id: 3, quantity: 1, order_date: '2024-01-17'},
                        {id: 4, customer_id: 3, product_id: 4, quantity: 1, order_date: '2024-01-18'}
                    ]
                };
            }
        }

        // テーブルデータプレビュー表示
        function displayTableDataPreview() {
            const previewArea = document.getElementById('previewTables');
            let html = '';
            
            for (const [tableName, data] of Object.entries(sqlSampleData)) {
                html += `<div style="margin-bottom: 25px;">`;
                html += `<h4 style="color: #4a5568; margin-bottom: 10px;">📋 ${tableName}テーブル</h4>`;
                
                if (data.length > 0) {
                    html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; background: white; border-radius: 6px; overflow: hidden;">`;
                    
                    // ヘッダー
                    html += `<thead style="background: #4299e1; color: white;">`;
                    html += `<tr>`;
                    Object.keys(data[0]).forEach(key => {
                        html += `<th style="padding: 8px; text-align: left; border-right: 1px solid #3182ce;">${key}</th>`;
                    });
                    html += `</tr></thead>`;
                    
                    // データ行（最初の3行のみ表示）
                    html += `<tbody>`;
                    data.slice(0, 3).forEach((row, index) => {
                        html += `<tr style="background: ${index % 2 === 0 ? '#f8f9fa' : 'white'};">`;
                        Object.values(row).forEach(value => {
                            html += `<td style="padding: 6px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">${value || 'null'}</td>`;
                        });
                        html += `</tr>`;
                    });
                    
                    if (data.length > 3) {
                        html += `<tr style="background: #edf2f7;">`;
                        html += `<td colspan="${Object.keys(data[0]).length}" style="padding: 6px; text-align: center; font-style: italic; color: #718096;">...他${data.length - 3}件</td>`;
                        html += `</tr>`;
                    }
                    
                    html += `</tbody></table>`;
                } else {
                    html += `<p style="color: #718096; font-style: italic;">データがありません</p>`;
                }
                html += `</div>`;
            }
            
            previewArea.innerHTML = html;
        }

        // サンプルクエリ設定
        function setSampleQuery(presetType) {
            const sqlInput = document.getElementById('sqlInput');
            
            if (presetType === 'school') {
                sqlInput.value = 'SELECT * FROM students WHERE grade = \'1年\';';
            } else if (presetType === 'library') {
                sqlInput.value = 'SELECT * FROM books;';
            } else if (presetType === 'ecommerce') {
                sqlInput.value = 'SELECT * FROM products WHERE price < 10000;';
            }
        }

        // SQL実行
        function executeSQLQuery() {
            const query = document.getElementById('sqlInput').value.trim();
            const resultsArea = document.getElementById('sqlResults');
            
            if (!query) {
                resultsArea.innerHTML = '<p style="color: #e53e3e;">⚠️ SQL文を入力してください</p>';
                return;
            }
            
            if (!currentSQLDataset) {
                resultsArea.innerHTML = '<p style="color: #e53e3e;">⚠️ まずプリセットを選択してください</p>';
                return;
            }
            
            try {
                const result = executeSQL(query);
                displaySQLResults(result, query);
            } catch (error) {
                resultsArea.innerHTML = `<p style="color: #e53e3e;">❌ エラー: ${error.message}</p>`;
            }
        }

        // 簡易SQL実行エンジン（SELECT文のみ対応）
        function executeSQL(query) {
            // SQLを小文字に変換して解析
            const lowerQuery = query.toLowerCase().trim();
            
            if (!lowerQuery.startsWith('select')) {
                throw new Error('SELECT文のみ対応しています');
            }
            
            // 基本的なSELECT文の解析
            const selectMatch = lowerQuery.match(/select\s+(.*?)\s+from\s+(\w+)(?:\s+where\s+(.*))?/);
            
            if (!selectMatch) {
                throw new Error('SQL文の構文が正しくありません');
            }
            
            const columns = selectMatch[1].trim();
            const tableName = selectMatch[2].trim();
            const whereClause = selectMatch[3];
            
            // テーブル存在チェック
            if (!sqlSampleData[tableName]) {
                throw new Error(`テーブル '${tableName}' が存在しません`);
            }
            
            let data = [...sqlSampleData[tableName]];
            
            // WHERE句の処理
            if (whereClause) {
                data = filterData(data, whereClause);
            }
            
            // カラム選択の処理
            if (columns !== '*') {
                const selectedColumns = columns.split(',').map(c => c.trim());
                data = data.map(row => {
                    const newRow = {};
                    selectedColumns.forEach(col => {
                        if (row.hasOwnProperty(col)) {
                            newRow[col] = row[col];
                        }
                    });
                    return newRow;
                });
            }
            
            return { data, rowCount: data.length, tableName };
        }

        // WHERE句の簡易フィルタリング
        function filterData(data, whereClause) {
            return data.filter(row => {
                // 簡単な条件のみ対応（column = 'value' or column = number）
                const conditions = whereClause.split(/\s+and\s+/);
                
                return conditions.every(condition => {
                    const eqMatch = condition.match(/(\w+)\s*=\s*'([^']*)'|(\w+)\s*=\s*(\d+)/);
                    const ltMatch = condition.match(/(\w+)\s*<\s*(\d+)/);
                    const gtMatch = condition.match(/(\w+)\s*>\s*(\d+)/);
                    
                    if (eqMatch) {
                        const column = eqMatch[1] || eqMatch[3];
                        const value = eqMatch[2] || parseInt(eqMatch[4]);
                        return row[column] == value;
                    } else if (ltMatch) {
                        const column = ltMatch[1];
                        const value = parseInt(ltMatch[2]);
                        return row[column] < value;
                    } else if (gtMatch) {
                        const column = gtMatch[1];
                        const value = parseInt(gtMatch[2]);
                        return row[column] > value;
                    }
                    
                    return true;
                });
            });
        }

        // SQL実行結果表示
        function displaySQLResults(result, query) {
            const resultsArea = document.getElementById('sqlResults');
            
            if (result.data.length === 0) {
                resultsArea.innerHTML = '<p style="color: #718096;">📝 条件に一致するデータが見つかりませんでした</p>';
                return;
            }
            
            let html = `<div style="margin-bottom: 15px;">`;
            html += `<h4 style="color: #4a5568;">✅ 実行成功 (${result.rowCount}件)</h4>`;
            html += `<p style="font-size: 12px; color: #718096; font-family: monospace; background: #f1f5f9; padding: 5px; border-radius: 4px;">${query}</p>`;
            html += `</div>`;
            
            // 結果テーブル
            html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; background: white; border-radius: 6px; overflow: hidden;">`;
            
            // ヘッダー
            if (result.data.length > 0) {
                html += `<thead style="background: #48bb78; color: white;">`;
                html += `<tr>`;
                Object.keys(result.data[0]).forEach(key => {
                    html += `<th style="padding: 8px; text-align: left; border-right: 1px solid #38a169;">${key}</th>`;
                });
                html += `</tr></thead>`;
                
                // データ行
                html += `<tbody>`;
                result.data.forEach((row, index) => {
                    html += `<tr style="background: ${index % 2 === 0 ? '#f0fff4' : 'white'};">`;
                    Object.values(row).forEach(value => {
                        html += `<td style="padding: 6px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">${value || 'null'}</td>`;
                    });
                    html += `</tr>`;
                });
                html += `</tbody>`;
            }
            
            html += `</table>`;
            resultsArea.innerHTML = html;
        }

        // SQL入力クリア
        function clearSQLInput() {
            document.getElementById('sqlInput').value = '';
            document.getElementById('sqlResults').innerHTML = '<p style="text-align: center; color: #718096;">SQL文を実行すると、ここに結果が表示されます</p>';
        }

        // SQL例文表示
        function showSQLExamples() {
            if (!currentSQLDataset) {
                alert('⚠️ まずプリセットを選択してください');
                return;
            }
            
            const examples = {
                'school': [
                    { query: "SELECT * FROM students;", desc: "全生徒の情報を表示" },
                    { query: "SELECT name, grade FROM students WHERE grade = '1年';", desc: "1年生の名前と学年のみ表示" },
                    { query: "SELECT * FROM subjects WHERE credits > 3;", desc: "4単位以上の科目を表示" },
                    { query: "SELECT student_id, score FROM grades WHERE score > 90;", desc: "90点以上の成績を表示" },
                    { query: "SELECT * FROM students WHERE age < 17;", desc: "17歳未満の生徒を表示" }
                ],
                'library': [
                    { query: "SELECT * FROM books;", desc: "全ての本の情報を表示" },
                    { query: "SELECT title, author FROM books;", desc: "全ての本のタイトルと著者のみ表示" },
                    { query: "SELECT * FROM users WHERE membership_type = '学生';", desc: "学生会員のみ表示" },
                    { query: "SELECT * FROM loans WHERE return_date = null;", desc: "現在貸出中の本を表示" },
                    { query: "SELECT title, author FROM books WHERE author = '情報太郎';", desc: "特定の著者の本を表示" }
                ],
                'ecommerce': [
                    { query: "SELECT * FROM products;", desc: "全商品の情報を表示" },
                    { query: "SELECT name, price FROM products WHERE price < 10000;", desc: "1万円未満の商品を表示" },
                    { query: "SELECT * FROM customers WHERE city = '東京都';", desc: "東京都の顧客のみ表示" },
                    { query: "SELECT customer_id, quantity FROM orders WHERE quantity > 1;", desc: "2個以上購入した注文を表示" },
                    { query: "SELECT * FROM products WHERE stock < 20;", desc: "在庫が少ない商品を表示" }
                ]
            };
            
            const currentExamples = examples[currentSQLDataset] || examples['school'];
            
            // 例文選択モーダルを作成
            showSQLExamplesModal(currentExamples);
        }
        
        // SQL例文選択モーダル表示
        function showSQLExamplesModal(examples) {
            // 既存のモーダルがあれば削除
            const existingModal = document.getElementById('sqlExamplesModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // 新しいモーダルを作成
            const modal = document.createElement('div');
            modal.id = 'sqlExamplesModal';
            modal.style.cssText = `
                display: block;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                margin: 5% auto;
                padding: 0;
                border-radius: 12px;
                width: 80%;
                max-width: 700px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            `;
            
            modalContent.innerHTML = `
                <div style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
                    <h2 style="margin: 0; display: flex; justify-content: space-between; align-items: center;">
                        📝 SQL例文集
                        <button onclick="closeSQLExamplesModal()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0;">×</button>
                    </h2>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">クリックすると入力エリアに挿入されます</p>
                </div>
                <div style="padding: 20px;">
                    ${examples.map((example, index) => `
                        <div onclick="insertSQLExample('${example.query.replace(/'/g, "\\'")}', ${index})" 
                             style="background: #f8f9fa; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; cursor: pointer; transition: all 0.2s;" 
                             onmouseover="this.style.borderColor='#4299e1'; this.style.backgroundColor='#ebf8ff';" 
                             onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='#f8f9fa';"
                             id="example-${index}">
                            <div style="font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; color: #2d3748; margin-bottom: 8px;">
                                ${example.query}
                            </div>
                            <div style="font-size: 12px; color: #718096;">
                                💡 ${example.desc}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="background: #f7fafc; padding: 15px; border-radius: 0 0 12px 12px; text-align: center; color: #718096; font-size: 14px;">
                    気になる例文をクリックして、SQL実行を試してみましょう！
                </div>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // モーダル外クリックで閉じる
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeSQLExamplesModal();
                }
            });
        }
        
        // SQL例文をテキストエリアに挿入
        function insertSQLExample(query, exampleIndex) {
            document.getElementById('sqlInput').value = query;
            
            // 挿入完了のフィードバック
            const exampleElement = document.getElementById(`example-${exampleIndex}`);
            if (exampleElement) {
                exampleElement.style.background = '#c6f6d5';
                exampleElement.style.borderColor = '#48bb78';
                setTimeout(() => {
                    exampleElement.style.background = '#f8f9fa';
                    exampleElement.style.borderColor = '#e2e8f0';
                }, 500);
            }
            
            // モーダルを閉じる
            setTimeout(() => {
                closeSQLExamplesModal();
            }, 300);
        }
        
        // SQL例文モーダルを閉じる
        function closeSQLExamplesModal() {
            const modal = document.getElementById('sqlExamplesModal');
            if (modal) {
                modal.remove();
            }
        }

        // インタラクティブコンテンツ実行
        function executeInteractiveContent(type) {
            if (type === 'normalization-demo') {
                // 正規化デモボタンの初期化
                console.log('正規化デモを準備しました');
            }
        }

        // ウィンドウリサイズ時にER図を再描画
        window.addEventListener('resize', function() {
            setTimeout(() => drawRelationLines(), 100);
        });
