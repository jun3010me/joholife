// データ圧縮学習ツール - メインスクリプト

class DataCompressionTool {
    constructor() {
        this.currentSection = 'run-length';
        this.currentSubsection = { 'run-length': 'basic', 'huffman': 'basic' };
        this.gridData = Array(8).fill().map(() => Array(8).fill(0)); // 0=A, 1=B
        this.practiceGridData = Array(8).fill().map(() => Array(8).fill(0));
        this.huffmanFrequencies = { A: 30, B: 25, C: 20, D: 15, E: 10 };
        this.huffmanCodes = {};
        this.huffmanTree = null;
        this.treeSteps = [];
        this.currentTreeStep = 0;
        this.progress = {
            'run-length': 0,
            'huffman': 0,
            'mixed': 0
        };
        this.achievements = [];
        this.lastTouch = null; // タッチのデバウンス用
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCanvas();
        this.loadProgress();
        this.updateDisplay();
        // SVGの初期サイズを設定
        this.initializeSVG();
    }

    setupEventListeners() {
        // メインナビゲーション
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // セクションナビゲーション
        document.querySelectorAll('.section-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = this.currentSection;
                const subsection = e.target.dataset.subsection;
                this.switchSubsection(section, subsection);
            });
        });

        // グリッドコントロール
        document.getElementById('clear-grid')?.addEventListener('click', () => this.clearGrid());
        document.getElementById('pattern-vertical')?.addEventListener('click', () => this.setPattern('vertical'));
        document.getElementById('pattern-horizontal')?.addEventListener('click', () => this.setPattern('horizontal'));
        document.getElementById('pattern-checker')?.addEventListener('click', () => this.setPattern('checker'));
        document.getElementById('pattern-random')?.addEventListener('click', () => this.setPattern('random'));

        // ハフマン符号化
        document.getElementById('build-huffman-tree')?.addEventListener('click', () => this.buildHuffmanTree());
        
        // 出現頻度入力
        ['a', 'b', 'c', 'd', 'e'].forEach(char => {
            const input = document.getElementById(`freq-${char}`);
            if (input) {
                input.addEventListener('input', () => this.updateFrequencyTotal());
            }
        });

        // 符号化練習
        document.getElementById('encode-text')?.addEventListener('click', () => this.encodeText());

        // 木構築コントロール
        document.getElementById('tree-step-back')?.addEventListener('click', () => this.treeStepBack());
        document.getElementById('tree-step-forward')?.addEventListener('click', () => this.treeStepForward());
        document.getElementById('tree-auto-play')?.addEventListener('click', () => this.treeAutoPlay());
        document.getElementById('tree-reset')?.addEventListener('click', () => this.treeReset());

        // 問題生成
        document.getElementById('generate-rl-problem')?.addEventListener('click', () => this.generateRunLengthProblem());
        document.getElementById('generate-hf-problem')?.addEventListener('click', () => this.generateHuffmanProblem());

        // 比較ツール
        document.getElementById('compare-methods')?.addEventListener('click', () => this.compareMethods());
        
        // 比較テキストのリアルタイムバリデーション
        const comparisonText = document.getElementById('comparison-text');
        if (comparisonText) {
            comparisonText.addEventListener('input', (e) => this.validateComparisonInput(e));
        }
    }

    setupCanvas() {
        const canvas = document.getElementById('pixel-grid');
        const practiceCanvas = document.getElementById('practice-grid');
        
        if (canvas) {
            this.setupCanvasElement(canvas, 'main');
            this.drawGrid(canvas, this.gridData);
        }
        
        if (practiceCanvas) {
            this.setupCanvasElement(practiceCanvas, 'practice');
            this.drawGrid(practiceCanvas, this.practiceGridData);
        }
    }
    
    setupCanvasElement(canvas, gridType) {
        // シンプルなCanvas設定（高DPI対応は一旦無効化）
        const rect = canvas.getBoundingClientRect();
        
        // 固定サイズに設定（レスポンシブ対応のため）
        const size = Math.min(rect.width, rect.height, 320);
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        
        console.log(`Canvas setup: Size=${size}x${size}, CSS=${canvas.style.width}x${canvas.style.height}`);
        
        // イベントリスナーを設定
        this.setupCanvasEvents(canvas, gridType);
    }
    
    setupCanvasEvents(canvas, gridType) {
        // 既存のイベントリスナーを削除
        canvas.removeEventListener('click', this.boundClickHandler);
        canvas.removeEventListener('touchstart', this.boundTouchHandler);
        canvas.removeEventListener('touchend', this.boundTouchEndHandler);
        canvas.removeEventListener('touchmove', this.boundTouchMoveHandler);
        
        // バインド済みハンドラーを作成
        this.boundClickHandler = (e) => this.handleGridClick(e, gridType);
        this.boundTouchHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleGridTouch(e, gridType);
        };
        this.boundTouchEndHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.boundTouchMoveHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        
        // イベントリスナーを追加
        canvas.addEventListener('click', this.boundClickHandler);
        canvas.addEventListener('touchstart', this.boundTouchHandler, { passive: false });
        canvas.addEventListener('touchend', this.boundTouchEndHandler, { passive: false });
        canvas.addEventListener('touchmove', this.boundTouchMoveHandler, { passive: false });
    }

    // ナビゲーション関連
    switchSection(section) {
        // アクティブなセクションを切り替え
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.getElementById(section).classList.add('active');
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        this.currentSection = section;
        this.updateSubsectionDisplay();
    }

    switchSubsection(section, subsection) {
        const sectionEl = document.getElementById(section);
        
        // セクション内のサブセクションを切り替え
        sectionEl.querySelectorAll('.subsection').forEach(sub => {
            sub.classList.remove('active');
        });
        sectionEl.querySelectorAll('.section-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const prefix = section === 'run-length' ? 'rl' : 'hf';
        document.getElementById(`${prefix}-${subsection}`).classList.add('active');
        sectionEl.querySelector(`[data-subsection="${subsection}"]`).classList.add('active');

        this.currentSubsection[section] = subsection;
    }

    updateSubsectionDisplay() {
        const section = this.currentSection;
        if (this.currentSubsection[section]) {
            this.switchSubsection(section, this.currentSubsection[section]);
        }
    }

    // グリッド関連
    drawGrid(canvas, data) {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const cellSize = canvas.width / 8; // Canvas実サイズベース
        
        // クリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const x = col * cellSize;
                const y = row * cellSize;
                
                // セルの背景色
                ctx.fillStyle = data[row][col] === 0 ? '#e3f2fd' : '#1976d2';
                ctx.fillRect(x, y, cellSize, cellSize);
                
                // セルの境界線
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, cellSize, cellSize);
                
                // セルの文字
                ctx.fillStyle = data[row][col] === 0 ? '#333' : '#fff';
                ctx.font = `${Math.max(16, cellSize * 0.4)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    data[row][col] === 0 ? 'A' : 'B',
                    x + cellSize / 2,
                    y + cellSize / 2
                );
            }
        }
    }

    handleGridClick(event, gridType) {
        const canvas = event.target;
        const { row, col } = this.getGridCoordinatesSimple(canvas, event.clientX, event.clientY);
        this.toggleGridCell(canvas, row, col, gridType);
    }
    
    handleGridTouch(event, gridType) {
        const canvas = event.target;
        const touch = event.touches[0] || event.changedTouches[0];
        
        // より安全な座標取得（iOS対応）
        const rect = canvas.getBoundingClientRect();
        
        // touch.targetがcanvasかどうか確認
        if (touch.target !== canvas) {
            console.log('Touch target mismatch');
            return;
        }
        
        // タッチ座標をCanvas座標に変換
        const clientX = touch.clientX;
        const clientY = touch.clientY;
        
        // Canvas内かどうかチェック（緩い境界チェック）
        if (clientX < rect.left - 10 || clientX > rect.right + 10 || 
            clientY < rect.top - 10 || clientY > rect.bottom + 10) {
            console.log('Touch far outside canvas bounds');
            return;
        }
        
        const { row, col } = this.getGridCoordinatesSimple(canvas, clientX, clientY);
        
        // デバッグ用ログ
        console.log(`Touch: clientX=${clientX}, clientY=${clientY}, row=${row}, col=${col}`);
        
        this.toggleGridCell(canvas, row, col, gridType);
    }
    
    getGridCoordinatesSimple(canvas, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        
        // Canvas内の相対位置を計算
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        // セルサイズを直接計算
        const cellWidth = rect.width / 8;
        const cellHeight = rect.height / 8;
        
        // グリッド位置を直接計算
        let col = Math.floor(x / cellWidth);
        let row = Math.floor(y / cellHeight);
        
        // 右端と下端の特別処理
        if (x >= rect.width - 1) col = 7;
        if (y >= rect.height - 1) row = 7;
        
        // 最終的な範囲チェック
        const finalCol = Math.max(0, Math.min(7, col));
        const finalRow = Math.max(0, Math.min(7, row));
        
        console.log(`=== Grid Calculation ===`);
        console.log(`Touch: clientX=${clientX}, clientY=${clientY}`);
        console.log(`Canvas rect: left=${rect.left}, top=${rect.top}, width=${rect.width}, height=${rect.height}`);
        console.log(`Canvas pos: x=${x}, y=${y}`);
        console.log(`Cell size: width=${cellWidth}, height=${cellHeight}`);
        console.log(`Raw grid: row=${row}, col=${col}`);
        console.log(`Final grid: row=${finalRow}, col=${finalCol}`);
        console.log(`========================`);
        
        return { row: finalRow, col: finalCol };
    }
    
    getGridCoordinates(canvas, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        
        // Canvasの実際のタッチ位置を計算（getBoundingClientRectは既にスクロール済み）
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;
        
        // 相対座標を計算（0.0〜1.0の範囲）
        const relativeX = canvasX / rect.width;
        const relativeY = canvasY / rect.height;
        
        // デバッグ用ログ（詳細版）
        console.log(`=== Touch Debug Info ===`);
        console.log(`Client coordinates: x=${clientX}, y=${clientY}`);
        console.log(`Canvas rect: left=${rect.left}, top=${rect.top}, width=${rect.width}, height=${rect.height}`);
        console.log(`Canvas-relative position: x=${canvasX}, y=${canvasY}`);
        console.log(`Relative coordinates: x=${relativeX}, y=${relativeY}`);
        console.log(`Device pixel ratio: ${window.devicePixelRatio}`);
        console.log(`Window size: ${window.innerWidth}x${window.innerHeight}`);
        console.log(`Document size: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`);
        
        // 8x8グリッドの位置を計算
        const col = Math.floor(relativeX * 8);
        const row = Math.floor(relativeY * 8);
        
        // 範囲チェック
        const clampedCol = Math.max(0, Math.min(7, col));
        const clampedRow = Math.max(0, Math.min(7, row));
        
        console.log(`Grid calculation: raw row=${row}, col=${col}`);
        console.log(`Final grid position: row=${clampedRow}, col=${clampedCol}`);
        console.log(`========================`);
        
        return { row: clampedRow, col: clampedCol };
    }
    
    toggleGridCell(canvas, row, col, gridType) {
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
            const data = gridType === 'main' ? this.gridData : this.practiceGridData;
            
            // 連続タッチを防ぐためのデバウンス処理
            const now = Date.now();
            const key = `${gridType}-${row}-${col}`;
            
            if (this.lastTouch && this.lastTouch.key === key && (now - this.lastTouch.time) < 300) {
                console.log('Debounced duplicate touch');
                return;
            }
            
            this.lastTouch = { key, time: now };
            
            // 視覚的フィードバック：タッチしたセルを一時的にハイライト
            this.highlightCell(canvas, row, col);
            
            // 即座に切り替えを実行（遅延なし）
            data[row][col] = 1 - data[row][col]; // 0↔1切り替え
            
            // 少し遅延してから再描画
            setTimeout(() => {
                this.drawGrid(canvas, data);
                
                if (gridType === 'main') {
                    this.updateRunLengthEncoding();
                } else {
                    this.updatePracticeResults();
                }
            }, 50);
        }
    }
    
    highlightCell(canvas, row, col) {
        const ctx = canvas.getContext('2d');
        const cellSize = canvas.width / 8;
        const x = col * cellSize;
        const y = row * cellSize;
        
        // 一時的にハイライト色で描画
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'; // 黄色の半透明
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    }

    clearGrid() {
        this.gridData = Array(8).fill().map(() => Array(8).fill(0));
        const canvas = document.getElementById('pixel-grid');
        this.drawGrid(canvas, this.gridData);
        this.updateRunLengthEncoding();
    }

    setPattern(type) {
        switch (type) {
            case 'vertical':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        this.gridData[row][col] = col % 2;
                    }
                }
                break;
            case 'horizontal':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        this.gridData[row][col] = row % 2;
                    }
                }
                break;
            case 'checker':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        this.gridData[row][col] = (row + col) % 2;
                    }
                }
                break;
            case 'random':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        this.gridData[row][col] = Math.random() < 0.5 ? 0 : 1;
                    }
                }
                break;
        }
        
        const canvas = document.getElementById('pixel-grid');
        this.drawGrid(canvas, this.gridData);
        this.updateRunLengthEncoding();
    }

    // ランレングス符号化
    updateRunLengthEncoding() {
        const { compressed, originalBits, compressedBits, details } = this.runLengthEncodeByRow(this.gridData);
        
        // 元データ表示（行ごとに改行）
        const originalBitsEl = document.getElementById('original-bits');
        if (originalBitsEl) {
            let originalText = '';
            for (let row = 0; row < 8; row++) {
                originalText += this.gridData[row].join('') + '\n';
            }
            originalBitsEl.textContent = originalText.trim();
        }
        
        // 圧縮データ表示
        const compressedBitsEl = document.getElementById('compressed-bits');
        const compressedSizeEl = document.getElementById('compressed-size');
        if (compressedBitsEl && compressedSizeEl) {
            compressedBitsEl.innerHTML = details.join('<br>');
            compressedSizeEl.textContent = `${compressedBits}ビット`;
        }
        
        // 圧縮率計算（圧縮後サイズ/元サイズ×100）
        const ratio = (compressedBits / originalBits * 100).toFixed(1);
        const ratioEl = document.getElementById('ratio-value');
        if (ratioEl) {
            ratioEl.textContent = `${ratio}%`;
            ratioEl.style.color = parseFloat(ratio) < 100 ? '#28a745' : '#dc3545';
        }
        
        // 最初のビット表示
        const firstBitEl = document.getElementById('first-bit');
        if (firstBitEl) {
            firstBitEl.textContent = '各行ごとに設定（A=0, B=1）';
        }
    }

    runLengthEncodeByRow(gridData) {
        let totalCompressedBits = 0;
        const details = [];
        const originalBits = 64; // 8x8 = 64ビット
        
        // 各行を処理
        for (let row = 0; row < 8; row++) {
            const rowData = gridData[row];
            const { bits, encoding, firstBit } = this.encodeRow(rowData);
            totalCompressedBits += bits;
            
            // 行の詳細を記録
            const rowBinary = rowData.join('');
            details.push(`行${row + 1}: ${rowBinary} → ${firstBit} ${encoding} (${bits}ビット)`);
        }
        
        return {
            originalBits,
            compressedBits: totalCompressedBits,
            details
        };
    }

    encodeRow(rowData) {
        const encodingParts = [];
        let totalBits = 1; // 最初のビット（行の開始文字を示す）
        let count = 1;
        let currentValue = rowData[0];
        
        // 最初のビット：A=0, B=1
        const firstBit = currentValue.toString();
        
        for (let i = 1; i < rowData.length; i++) {
            if (rowData[i] === currentValue && count < 8) { // 最大8個まで（3ビットで7まで表現可能、個数-1なので）
                count++;
            } else {
                // カウント-1を記録（0〜7の範囲）
                const countMinus1 = count - 1;
                encodingParts.push(countMinus1.toString(2).padStart(3, '0'));
                totalBits += 3;
                
                if (rowData[i] !== currentValue) {
                    // 文字が変わった場合
                    currentValue = rowData[i];
                    count = 1;
                } else {
                    // 9個目以降の場合は新しいブロックとして開始
                    count = 1;
                }
            }
        }
        
        // 最後のカウント
        const countMinus1 = count - 1;
        encodingParts.push(countMinus1.toString(2).padStart(3, '0'));
        totalBits += 3;
        
        return {
            bits: totalBits, // 最初の1ビット + カウント部分の3ビット×個数
            encoding: encodingParts.join(' '),
            firstBit: firstBit
        };
    }

    updatePracticeResults() {
        const { compressedBits } = this.runLengthEncodeByRow(this.practiceGridData);
        const originalBits = 64;
        const ratio = (compressedBits / originalBits * 100).toFixed(1);
        
        document.getElementById('practice-original').textContent = `${originalBits}ビット`;
        document.getElementById('practice-compressed').textContent = `${compressedBits}ビット`;
        document.getElementById('practice-ratio').textContent = `${ratio}%`;
        
        // 評価
        let evaluation = '';
        if (parseFloat(ratio) < 50) {
            evaluation = '非常に良い圧縮効率';
        } else if (parseFloat(ratio) < 80) {
            evaluation = '良い圧縮効率';
        } else if (parseFloat(ratio) < 100) {
            evaluation = '普通の圧縮効率';
        } else {
            evaluation = '圧縮効果なし（サイズ増加）';
        }
        
        document.getElementById('practice-evaluation').textContent = evaluation;
    }

    // ハフマン符号化
    updateFrequencyTotal() {
        let total = 0;
        ['a', 'b', 'c', 'd', 'e'].forEach(char => {
            const input = document.getElementById(`freq-${char}`);
            if (input) {
                total += parseInt(input.value) || 0;
            }
        });
        
        const totalEl = document.getElementById('freq-total');
        if (totalEl) {
            totalEl.textContent = total;
            totalEl.style.color = total === 100 ? '#28a745' : '#dc3545';
        }
    }

    buildHuffmanTree() {
        // 入力値を取得
        const frequencies = {};
        ['a', 'b', 'c', 'd', 'e'].forEach(char => {
            const input = document.getElementById(`freq-${char}`);
            if (input) {
                frequencies[char.toUpperCase()] = parseInt(input.value) || 0;
            }
        });
        
        // 合計が100%でない場合は警告
        const total = Object.values(frequencies).reduce((sum, freq) => sum + freq, 0);
        if (total !== 100) {
            alert('出現頻度の合計が100%になるように調整してください。');
            return;
        }
        
        this.huffmanFrequencies = frequencies;
        this.huffmanCodes = this.generateHuffmanCodes(frequencies);
        this.updateCodeTable();
        this.generateTreeSteps();
    }

    generateHuffmanCodes(frequencies) {
        // 優先度付きキュー（最小ヒープ）として配列を使用
        const nodes = Object.entries(frequencies)
            .filter(([char, freq]) => freq > 0)
            .map(([char, freq]) => ({ char, freq, left: null, right: null }))
            .sort((a, b) => a.freq - b.freq);
        
        while (nodes.length > 1) {
            const left = nodes.shift();
            const right = nodes.shift();
            
            const merged = {
                char: null,
                freq: left.freq + right.freq,
                left,
                right
            };
            
            // 適切な位置に挿入（頻度順を維持）
            let inserted = false;
            for (let i = 0; i < nodes.length; i++) {
                if (merged.freq <= nodes[i].freq) {
                    nodes.splice(i, 0, merged);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                nodes.push(merged);
            }
        }
        
        this.huffmanTree = nodes[0];
        
        // 符号を生成
        const codes = {};
        const generateCodes = (node, code = '') => {
            if (node.char !== null) {
                codes[node.char] = code || '0'; // 単一文字の場合
            } else {
                if (node.left) generateCodes(node.left, code + '0');
                if (node.right) generateCodes(node.right, code + '1');
            }
        };
        
        if (this.huffmanTree) {
            generateCodes(this.huffmanTree);
        }
        
        return codes;
    }

    updateCodeTable() {
        const tableBody = document.querySelector('#code-table tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        Object.entries(this.huffmanFrequencies)
            .filter(([char, freq]) => freq > 0)
            .sort((a, b) => b[1] - a[1]) // 頻度順でソート
            .forEach(([char, freq]) => {
                const row = tableBody.insertRow();
                row.insertCell(0).textContent = char;
                row.insertCell(1).textContent = `${freq}%`;
                row.insertCell(2).textContent = this.huffmanCodes[char] || '-';
                row.insertCell(3).textContent = (this.huffmanCodes[char] || '').length || '-';
            });
    }

    // 符号化練習
    encodeText() {
        const input = document.getElementById('text-input');
        const text = input.value.toUpperCase();
        
        if (!text) {
            alert('文字列を入力してください。');
            return;
        }
        
        // 利用可能な文字をチェック
        const availableChars = Object.keys(this.huffmanCodes);
        const invalidChars = [...text].filter(char => !availableChars.includes(char));
        
        if (invalidChars.length > 0) {
            alert(`以下の文字は符号表にありません: ${[...new Set(invalidChars)].join(', ')}`);
            return;
        }
        
        // 符号化
        let encoded = '';
        let originalBits = text.length * 8; // 固定長8ビット
        
        for (const char of text) {
            encoded += this.huffmanCodes[char];
        }
        
        const encodedBits = encoded.length;
        const ratio = (100 - (encodedBits / originalBits * 100)).toFixed(1);
        
        // 結果表示
        document.getElementById('encoded-text').textContent = encoded;
        document.getElementById('original-size').textContent = originalBits;
        document.getElementById('encoded-size').textContent = encodedBits;
        document.getElementById('encode-ratio').textContent = ratio;
        
        // 復号化確認
        const decoded = this.decodeHuffman(encoded);
        document.getElementById('decoded-text').textContent = decoded;
    }

    decodeHuffman(encoded) {
        if (!this.huffmanTree || !encoded) return '';
        
        let decoded = '';
        let current = this.huffmanTree;
        
        for (const bit of encoded) {
            if (current.char !== null) {
                decoded += current.char;
                current = this.huffmanTree;
            }
            
            current = bit === '0' ? current.left : current.right;
            
            if (!current) {
                return 'エラー: 無効な符号';
            }
        }
        
        if (current.char !== null) {
            decoded += current.char;
        }
        
        return decoded;
    }

    // 木構築アニメーション
    generateTreeSteps() {
        const frequencies = this.huffmanFrequencies;
        const steps = [];
        const builtTrees = []; // 構築された木の履歴
        
        // 初期ノード
        let nodes = Object.entries(frequencies)
            .filter(([char, freq]) => freq > 0)
            .map(([char, freq]) => ({ char, freq, left: null, right: null }))
            .sort((a, b) => a.freq - b.freq);
        
        steps.push({
            nodes: [...nodes],
            tree: null,
            description: '初期状態：各文字を頻度順に並べます'
        });
        
        while (nodes.length > 1) {
            const left = nodes.shift();
            const right = nodes.shift();
            
            const merged = {
                char: null,
                freq: left.freq + right.freq,
                left: this.deepCopyNode(left),
                right: this.deepCopyNode(right)
            };
            
            // 適切な位置に挿入
            let inserted = false;
            for (let i = 0; i < nodes.length; i++) {
                if (merged.freq <= nodes[i].freq) {
                    nodes.splice(i, 0, merged);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                nodes.push(merged);
            }
            
            // 最新の構築された木を保存
            const currentTree = nodes.length === 1 ? nodes[0] : this.findLargestTree(nodes);
            
            steps.push({
                nodes: [...nodes],
                tree: this.deepCopyNode(currentTree),
                merged: { left: left.char || 'merged', right: right.char || 'merged', freq: merged.freq },
                description: `${left.char || '結合ノード'}(${left.freq}) と ${right.char || '結合ノード'}(${right.freq}) を結合 → 新ノード(${merged.freq})`
            });
        }
        
        this.treeSteps = steps;
        this.currentTreeStep = 0;
        this.updateTreeDisplay();
    }
    
    deepCopyNode(node) {
        if (!node) return null;
        return {
            char: node.char,
            freq: node.freq,
            left: this.deepCopyNode(node.left),
            right: this.deepCopyNode(node.right)
        };
    }
    
    findLargestTree(nodes) {
        // 最も複雑な（子ノードを持つ）木を見つける
        let largestTree = null;
        let maxDepth = 0;
        
        for (const node of nodes) {
            if (node.left || node.right) {
                const depth = this.getTreeDepth(node);
                if (depth > maxDepth) {
                    maxDepth = depth;
                    largestTree = node;
                }
            }
        }
        
        return largestTree;
    }
    
    getTreeDepth(node) {
        if (!node) return 0;
        return 1 + Math.max(this.getTreeDepth(node.left), this.getTreeDepth(node.right));
    }

    updateTreeDisplay() {
        if (this.treeSteps.length === 0) return;
        
        const step = this.treeSteps[this.currentTreeStep];
        const descriptionEl = document.getElementById('tree-step-text');
        
        if (descriptionEl) {
            descriptionEl.textContent = `ステップ ${this.currentTreeStep + 1}/${this.treeSteps.length}: ${step.description}`;
        }
        
        // SVGで木を描画（簡略版）
        this.drawTreeSVG(step);
    }
    
    initializeSVG() {
        const svg = document.getElementById('huffman-tree');
        if (svg) {
            this.adjustSVGSize(svg);
        }
    }
    
    adjustSVGSize(svg, requiredHeight = null) {
        if (!svg) return;
        
        const container = svg.closest('.tree-display');
        const treeContainer = svg.closest('.tree-container');
        
        // コンテナの実際の利用可能幅を計算
        let availableWidth;
        if (container && treeContainer) {
            const containerPadding = 32; // tree-container padding + tree-display padding
            const scrollbarWidth = 20; // スクロールバー用の余白
            availableWidth = treeContainer.offsetWidth - containerPadding - scrollbarWidth;
        } else {
            availableWidth = window.innerWidth - 60;
        }
        
        // 画面サイズに応じてSVGサイズを調整
        let svgWidth, svgHeight;
        
        // iPhoneや小さなスマホの場合
        if (window.innerWidth <= 414) { // iPhone Pro Maxの幅まで対応
            svgWidth = Math.min(350, availableWidth);
            svgHeight = requiredHeight || 280;
        } else if (window.innerWidth <= 480) {
            svgWidth = Math.min(400, availableWidth);
            svgHeight = requiredHeight || 300;
        } else if (window.innerWidth <= 768) {
            // 中型スマホ・タブレット
            svgWidth = Math.min(580, availableWidth);
            svgHeight = requiredHeight || 400;
        } else {
            // デスクトップ
            svgWidth = Math.min(780, availableWidth);
            svgHeight = requiredHeight || 500;
        }
        
        // 最小サイズを保証
        svgWidth = Math.max(280, svgWidth);
        svgHeight = Math.max(200, svgHeight);
        
        svg.setAttribute('width', svgWidth);
        svg.setAttribute('height', svgHeight);
        svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        
        // CSSでも明示的にサイズ設定
        svg.style.width = svgWidth + 'px';
        svg.style.height = svgHeight + 'px';
        svg.style.maxWidth = 'none'; // スクロール可能にするため
        
        // グローバル変数として保存（描画メソッドで使用）
        this.currentSVGWidth = svgWidth;
        this.currentSVGHeight = svgHeight;
        
        console.log(`SVG Size adjusted: ${svgWidth}x${svgHeight}, Available: ${availableWidth}, Window: ${window.innerWidth}x${window.innerHeight}`);
    }
    
    calculateRequiredHeight(step) {
        if (!step.tree) {
            return window.innerWidth <= 414 ? 280 : 350; // 最小高さ
        }
        
        // 木の深さを計算
        const treeDepth = this.getTreeDepth(step.tree);
        const baseHeight = 200; // キュー部分の高さ
        const levelHeight = window.innerWidth <= 414 ? 50 : 60;
        const bottomMargin = 40;
        
        const requiredHeight = baseHeight + (treeDepth * levelHeight) + bottomMargin;
        
        // 最小・最大高さを制限
        return Math.max(280, Math.min(800, requiredHeight));
    }

    drawTreeSVG(step) {
        const svg = document.getElementById('huffman-tree');
        if (!svg) return;
        
        // 必要な高さを計算
        const requiredHeight = this.calculateRequiredHeight(step);
        
        // SVGサイズをレスポンシブに調整
        this.adjustSVGSize(svg, requiredHeight);
        
        svg.innerHTML = '';
        
        // 2つのセクションに分けて表示
        // 上部：優先度キュー（残りのノード）
        // 下部：構築中のハフマン木
        
        // 上部：優先度キュー
        const queueY = 80;
        const nodeSpacing = Math.min(80, (this.currentSVGWidth - 80) / Math.max(1, step.nodes.length));
        const startX = Math.max(40, (this.currentSVGWidth - (step.nodes.length - 1) * nodeSpacing) / 2);
        
        step.nodes.forEach((node, index) => {
            const x = startX + index * nodeSpacing;
            this.drawNode(svg, node, x, queueY, '優先度キュー');
        });
        
        // ラベル
        const queueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        queueLabel.setAttribute('x', 20);
        queueLabel.setAttribute('y', 30);
        queueLabel.setAttribute('font-size', '14');
        queueLabel.setAttribute('font-weight', 'bold');
        queueLabel.setAttribute('fill', '#333');
        queueLabel.textContent = '優先度キュー（未処理）';
        svg.appendChild(queueLabel);
        
        // 下部：構築されたハフマン木
        if (this.currentTreeStep > 0 && step.tree) {
            const treeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            treeLabel.setAttribute('x', 20);
            treeLabel.setAttribute('y', 180);
            treeLabel.setAttribute('font-size', '14');
            treeLabel.setAttribute('font-weight', 'bold');
            treeLabel.setAttribute('fill', '#333');
            treeLabel.textContent = '構築中のハフマン木';
            svg.appendChild(treeLabel);
            
            // 木の中央位置を画面サイズに応じて調整
            const treeCenterX = this.currentSVGWidth / 2;
            const treeStartY = 200; // 木の開始Y位置
            this.drawBinaryTree(svg, step.tree, treeCenterX, treeStartY);
        }
    }
    
    drawNode(svg, node, x, y, type) {
        // サイズを画面サイズに応じて調整
        const radius = window.innerWidth <= 414 ? 18 : 25;
        const fontSize = window.innerWidth <= 414 ? '10' : '12';
        const freqFontSize = window.innerWidth <= 414 ? '8' : '9';
        
        // ノード円
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', node.char ? '#667eea' : '#28a745');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', 2);
        svg.appendChild(circle);
        
        // ノードラベル
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y - 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-size', fontSize);
        text.setAttribute('font-weight', 'bold');
        text.textContent = node.char || '*';
        svg.appendChild(text);
        
        // 頻度
        const freqText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        freqText.setAttribute('x', x);
        freqText.setAttribute('y', y + 6);
        freqText.setAttribute('text-anchor', 'middle');
        freqText.setAttribute('fill', 'white');
        freqText.setAttribute('font-size', freqFontSize);
        freqText.textContent = node.freq;
        svg.appendChild(freqText);
    }
    
    drawBinaryTree(svg, node, x, y, level = 0) {
        if (!node) return;
        
        // サイズを画面サイズに応じて調整
        const nodeRadius = window.innerWidth <= 414 ? 15 : Math.min(20, this.currentSVGWidth / 30);
        const levelGap = window.innerWidth <= 414 ? 45 : Math.min(60, this.currentSVGHeight / 8);
        
        // 水平間隔を調整（レベルに応じて縮小）
        const baseGap = window.innerWidth <= 414 ? 80 : Math.min(120, this.currentSVGWidth / 6);
        const horizontalGap = Math.max(25, baseGap / Math.pow(1.5, level));
        
        // 現在のノードを描画
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', nodeRadius);
        circle.setAttribute('fill', node.char ? '#667eea' : '#28a745');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', 2);
        svg.appendChild(circle);
        
        // ノードラベル
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y - 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-weight', 'bold');
        text.textContent = node.char || '*';
        svg.appendChild(text);
        
        // 頻度
        const freqText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        freqText.setAttribute('x', x);
        freqText.setAttribute('y', y + 7);
        freqText.setAttribute('text-anchor', 'middle');
        freqText.setAttribute('fill', 'white');
        freqText.setAttribute('font-size', '8');
        freqText.textContent = node.freq;
        svg.appendChild(freqText);
        
        // 左の子ノード
        if (node.left) {
            const leftX = x - horizontalGap;
            const leftY = y + levelGap;
            
            // 線を描画
            const leftLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            leftLine.setAttribute('x1', x);
            leftLine.setAttribute('y1', y + nodeRadius);
            leftLine.setAttribute('x2', leftX);
            leftLine.setAttribute('y2', leftY - nodeRadius);
            leftLine.setAttribute('stroke', '#333');
            leftLine.setAttribute('stroke-width', 2);
            svg.appendChild(leftLine);
            
            // "0"ラベル
            const leftLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            leftLabel.setAttribute('x', (x + leftX) / 2 - 5);
            leftLabel.setAttribute('y', (y + leftY) / 2);
            leftLabel.setAttribute('font-size', '12');
            leftLabel.setAttribute('font-weight', 'bold');
            leftLabel.setAttribute('fill', '#dc3545');
            leftLabel.textContent = '0';
            svg.appendChild(leftLabel);
            
            this.drawBinaryTree(svg, node.left, leftX, leftY, level + 1);
        }
        
        // 右の子ノード
        if (node.right) {
            const rightX = x + horizontalGap;
            const rightY = y + levelGap;
            
            // 線を描画
            const rightLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            rightLine.setAttribute('x1', x);
            rightLine.setAttribute('y1', y + nodeRadius);
            rightLine.setAttribute('x2', rightX);
            rightLine.setAttribute('y2', rightY - nodeRadius);
            rightLine.setAttribute('stroke', '#333');
            rightLine.setAttribute('stroke-width', 2);
            svg.appendChild(rightLine);
            
            // "1"ラベル
            const rightLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            rightLabel.setAttribute('x', (x + rightX) / 2 + 5);
            rightLabel.setAttribute('y', (y + rightY) / 2);
            rightLabel.setAttribute('font-size', '12');
            rightLabel.setAttribute('font-weight', 'bold');
            rightLabel.setAttribute('fill', '#28a745');
            rightLabel.textContent = '1';
            svg.appendChild(rightLabel);
            
            this.drawBinaryTree(svg, node.right, rightX, rightY, level + 1);
        }
    }

    treeStepBack() {
        if (this.currentTreeStep > 0) {
            this.currentTreeStep--;
            this.updateTreeDisplay();
        }
    }

    treeStepForward() {
        if (this.currentTreeStep < this.treeSteps.length - 1) {
            this.currentTreeStep++;
            this.updateTreeDisplay();
        }
    }

    treeAutoPlay() {
        if (this.currentTreeStep < this.treeSteps.length - 1) {
            this.currentTreeStep++;
            this.updateTreeDisplay();
            setTimeout(() => this.treeAutoPlay(), 2000);
        }
    }

    treeReset() {
        this.currentTreeStep = 0;
        this.updateTreeDisplay();
    }

    // 問題生成
    generateRunLengthProblem() {
        const patterns = [
            { name: '縦縞パターン', data: 'vertical' },
            { name: '横縞パターン', data: 'horizontal' },
            { name: 'チェックパターン', data: 'checker' },
            { name: 'ランダムパターン', data: 'random' }
        ];
        
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        
        // パターンを生成
        let gridData = Array(8).fill().map(() => Array(8).fill(0));
        switch (pattern.data) {
            case 'vertical':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        gridData[row][col] = col % 2;
                    }
                }
                break;
            case 'horizontal':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        gridData[row][col] = row % 2;
                    }
                }
                break;
            case 'checker':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        gridData[row][col] = (row + col) % 2;
                    }
                }
                break;
            case 'random':
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        gridData[row][col] = Math.random() < 0.5 ? 0 : 1;
                    }
                }
                break;
        }
        
        const { compressedBits } = this.runLengthEncodeByRow(gridData);
        const ratio = (100 - (compressedBits / 64 * 100)).toFixed(1);
        
        const problemHTML = `
            <div class="problem">
                <h4>問題: ${pattern.name}の圧縮</h4>
                <p>以下の8×8パターンをランレングス符号化した場合の削減率を求めてください。</p>
                <div class="problem-grid">
                    <canvas width="320" height="320" id="problem-canvas"></canvas>
                </div>
                <div class="problem-answer">
                    <label>削減率:</label>
                    <input type="number" id="answer-input" min="0" max="100" step="0.1">%
                    <button onclick="tool.checkRunLengthAnswer(${ratio})">解答確認</button>
                </div>
                <div id="answer-result"></div>
            </div>
        `;
        
        const container = document.getElementById('rl-problem-display');
        if (container) {
            container.innerHTML = problemHTML;
            
            // 問題グリッドを描画
            setTimeout(() => {
                const canvas = document.getElementById('problem-canvas');
                if (canvas) {
                    this.drawGrid(canvas, gridData);
                }
            }, 100);
        }
    }

    checkRunLengthAnswer(correctAnswer) {
        const input = document.getElementById('answer-input');
        const userAnswer = parseFloat(input.value);
        const resultEl = document.getElementById('answer-result');
        
        if (Math.abs(userAnswer - correctAnswer) < 0.5) {
            resultEl.innerHTML = '<div style="color: #28a745; font-weight: bold;">正解！</div>';
            this.updateProgress('run-length', 10);
        } else {
            resultEl.innerHTML = `<div style="color: #dc3545; font-weight: bold;">不正解。正解は ${correctAnswer}% です。</div>`;
        }
    }

    generateHuffmanProblem() {
        const characters = ['A', 'B', 'C', 'D'];
        const frequencies = this.generateRandomFrequencies(characters);
        const codes = this.generateHuffmanCodes(frequencies);
        
        const problemHTML = `
            <div class="problem">
                <h4>問題: ハフマン符号表の作成</h4>
                <p>以下の出現頻度からハフマン符号表を作成してください。</p>
                <table class="frequency-table">
                    <tr><th>文字</th><th>出現頻度</th><th>符号</th></tr>
                    ${characters.map(char => `
                        <tr>
                            <td>${char}</td>
                            <td>${frequencies[char]}%</td>
                            <td><input type="text" id="code-${char}" placeholder="符号を入力"></td>
                        </tr>
                    `).join('')}
                </table>
                <button onclick="tool.checkHuffmanAnswer(${JSON.stringify(codes).replace(/"/g, '&quot;')})">解答確認</button>
                <div id="huffman-answer-result"></div>
            </div>
        `;
        
        const container = document.getElementById('hf-problem-display');
        if (container) {
            container.innerHTML = problemHTML;
        }
    }

    generateRandomFrequencies(characters) {
        const frequencies = {};
        let remaining = 100;
        
        for (let i = 0; i < characters.length - 1; i++) {
            const max = remaining - (characters.length - i - 1) * 5;
            const freq = Math.floor(Math.random() * (max - 5)) + 5;
            frequencies[characters[i]] = freq;
            remaining -= freq;
        }
        
        frequencies[characters[characters.length - 1]] = remaining;
        
        return frequencies;
    }

    checkHuffmanAnswer(correctCodes) {
        const userCodes = {};
        let allCorrect = true;
        
        Object.keys(correctCodes).forEach(char => {
            const input = document.getElementById(`code-${char}`);
            if (input) {
                userCodes[char] = input.value.trim();
                if (userCodes[char] !== correctCodes[char]) {
                    allCorrect = false;
                }
            }
        });
        
        const resultEl = document.getElementById('huffman-answer-result');
        
        if (allCorrect) {
            resultEl.innerHTML = '<div style="color: #28a745; font-weight: bold;">正解！</div>';
            this.updateProgress('huffman', 15);
        } else {
            let resultHTML = '<div style="color: #dc3545; font-weight: bold;">不正解。正解は以下の通りです：</div><ul>';
            Object.entries(correctCodes).forEach(([char, code]) => {
                resultHTML += `<li>${char}: ${code}</li>`;
            });
            resultHTML += '</ul>';
            resultEl.innerHTML = resultHTML;
        }
    }

    // 比較ツール
    compareMethods() {
        const text = document.getElementById('comparison-text').value;
        if (!text) {
            alert('比較するテキストを入力してください。');
            return;
        }
        
        // 入力文字のバリデーション（半角英数字のみ）
        const validChars = /^[A-Za-z0-9]+$/;
        if (!validChars.test(text)) {
            alert('半角英数字（A-Z, a-z, 0-9）のみ入力してください。');
            return;
        }
        
        // 文字種数に基づいたビット数計算
        const { originalSize, bitsPerChar, uniqueChars, calculation } = this.calculateOptimalBits(text);
        
        // ランレングス符号化（最適化版）
        const rlSize = this.calculateOptimalRunLength(text, bitsPerChar);
        const rlRatio = (100 - (rlSize / originalSize * 100)).toFixed(1);
        
        // ハフマン符号化（最適化版）
        const hfSize = this.calculateOptimalHuffman(text, uniqueChars);
        const hfRatio = (100 - (hfSize / originalSize * 100)).toFixed(1);
        
        // 結果表示
        document.getElementById('uncompressed-size').textContent = originalSize;
        document.getElementById('rl-comp-size').textContent = rlSize;
        document.getElementById('rl-comp-ratio').textContent = rlRatio;
        document.getElementById('hf-comp-size').textContent = hfSize;
        document.getElementById('hf-comp-ratio').textContent = hfRatio;
        
        // ビット数計算の根拠表示
        document.getElementById('bit-calculation').innerHTML = calculation;
    }
    
    calculateOptimalBits(text) {
        // 大文字小文字を区別してユニーク文字を計算
        const uniqueChars = [...new Set(text)].sort();
        const uniqueCount = uniqueChars.length;
        
        // 必要なビット数を計算
        let bitsPerChar;
        if (uniqueCount === 1) {
            bitsPerChar = 1; // 1種類の場合でも最低1ビット
        } else {
            bitsPerChar = Math.ceil(Math.log2(uniqueCount));
        }
        
        const originalSize = text.length * bitsPerChar;
        
        // 計算根拠の表示文を作成
        const calculation = `
            <strong>ビット数計算:</strong><br>
            入力文字: "${text}"<br>
            ユニーク文字: [${uniqueChars.join(', ')}] (${uniqueCount}種類)<br>
            1文字あたり: ⌈log₂(${uniqueCount})⌉ = ${bitsPerChar}ビット<br>
            合計: ${text.length}文字 × ${bitsPerChar}ビット = ${originalSize}ビット
        `;
        
        return {
            originalSize,
            bitsPerChar,
            uniqueChars,
            calculation
        };
    }
    
    validateComparisonInput(event) {
        const input = event.target;
        const text = input.value;
        
        // 半角英数字以外を除去
        const validText = text.replace(/[^A-Za-z0-9]/g, '');
        
        if (validText !== text) {
            input.value = validText;
            // 無効文字が入力されたことを一時的に表示
            this.showInputWarning(input);
        }
        
        // リアルタイムでビット数計算を表示
        if (validText.length > 0) {
            const { calculation } = this.calculateOptimalBits(validText);
            const bitCalcEl = document.getElementById('bit-calculation');
            if (bitCalcEl) {
                bitCalcEl.innerHTML = calculation;
            }
        } else {
            const bitCalcEl = document.getElementById('bit-calculation');
            if (bitCalcEl) {
                bitCalcEl.innerHTML = '';
            }
        }
    }
    
    showInputWarning(input) {
        input.style.borderColor = '#dc3545';
        input.style.backgroundColor = '#fff5f5';
        
        setTimeout(() => {
            input.style.borderColor = '';
            input.style.backgroundColor = '';
        }, 1000);
    }
    
    calculateRunLengthBits(encoded, uniqueCharCount) {
        // ランレングス符号化の結果をビット数で計算
        // 文字種類数に応じたビット数で文字を表現
        const charBits = uniqueCharCount === 1 ? 1 : Math.ceil(Math.log2(uniqueCharCount));
        // 簡単なランレングスでは文字+数字のペアなので、文字部分と数字部分を分けて計算
        let totalBits = 0;
        for (let i = 0; i < encoded.length; i += 2) {
            totalBits += charBits; // 文字部分
            totalBits += 4; // 数字部分（最大9までで、4ビットで十分）
        }
        return totalBits;
    }
    
    calculateCharacterFrequencyForComparison(text) {
        const freq = {};
        const total = text.length;
        
        // 大文字小文字を区別して頻度を計算
        for (const char of text) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        // パーセンテージに変換
        Object.keys(freq).forEach(char => {
            freq[char] = Math.round((freq[char] / total) * 100);
        });
        
        return freq;
    }
    
    calculateOptimalRunLength(text, bitsPerChar) {
        // 最適化されたランレングス符号化
        const runs = [];
        let current = text[0];
        let count = 1;
        
        for (let i = 1; i < text.length; i++) {
            if (text[i] === current) {
                count++;
            } else {
                runs.push({ char: current, count });
                current = text[i];
                count = 1;
            }
        }
        runs.push({ char: current, count });
        
        // ビット数計算
        let totalBits = 0;
        for (const run of runs) {
            totalBits += bitsPerChar; // 文字を表現するビット
            // 連続数を表現するビット（最大9までなのて4ビットで十分）
            totalBits += Math.ceil(Math.log2(Math.max(2, run.count + 1)));
        }
        
        return totalBits;
    }
    
    calculateOptimalHuffman(text, uniqueChars) {
        // 最適化されたハフマン符号化
        const freq = {};
        
        // 文字頻度を計算
        for (const char of text) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        // 文字数が少ない場合は理論的なハフマン符号を計算
        if (uniqueChars.length === 1) {
            return text.length; // 1文字あたり1ビット
        } else if (uniqueChars.length === 2) {
            return text.length; // 2文字なら1文字あたり1ビット
        }
        
        // 3文字以上の場合は簡単なハフマン計算
        const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        let totalBits = 0;
        
        // 最頻出文字に短い符号、低頻度文字に長い符号を割り当て
        for (let i = 0; i < sortedFreq.length; i++) {
            const [char, count] = sortedFreq[i];
            const codeBits = i === 0 ? 1 : Math.ceil(Math.log2(i + 2));
            totalBits += count * codeBits;
        }
        
        return Math.max(1, totalBits);
    }

    simpleRunLength(text) {
        // 簡単なランレングス符号化（実際の実装は複雑）
        let result = '';
        let count = 1;
        let current = text[0];
        
        for (let i = 1; i < text.length; i++) {
            if (text[i] === current && count < 9) {
                count++;
            } else {
                result += current + count;
                current = text[i];
                count = 1;
            }
        }
        result += current + count;
        
        return result;
    }

    calculateCharacterFrequency(text) {
        const freq = {};
        const total = text.length;
        
        for (const char of text.toUpperCase()) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        // パーセンテージに変換
        Object.keys(freq).forEach(char => {
            freq[char] = Math.round((freq[char] / total) * 100);
        });
        
        return freq;
    }

    // 進捗管理
    updateProgress(section, points) {
        this.progress[section] = Math.min(100, this.progress[section] + points);
        this.saveProgress();
        this.updateProgressDisplay();
        this.checkAchievements();
    }

    updateProgressDisplay() {
        Object.entries(this.progress).forEach(([section, progress]) => {
            const progressEl = document.querySelector(`[data-progress]`);
            if (progressEl) {
                progressEl.style.width = `${progress}%`;
                progressEl.parentElement.nextElementSibling.textContent = `${progress}% 完了`;
            }
        });
    }

    checkAchievements() {
        const achievements = [
            { id: 'rl-basic', condition: () => this.progress['run-length'] >= 20, text: 'ランレングス符号化の基本を理解' },
            { id: 'rl-calc', condition: () => this.progress['run-length'] >= 50, text: '初回圧縮率計算成功' },
            { id: 'hf-basic', condition: () => this.progress['huffman'] >= 20, text: 'ハフマン木構築の理解' },
            { id: 'hf-table', condition: () => this.progress['huffman'] >= 50, text: '符号表作成成功' },
            { id: 'comparison', condition: () => this.progress['mixed'] >= 30, text: '両方式の比較理解' }
        ];
        
        achievements.forEach(achievement => {
            if (achievement.condition() && !this.achievements.includes(achievement.id)) {
                this.achievements.push(achievement.id);
                this.unlockAchievement(achievement.id);
            }
        });
    }

    unlockAchievement(id) {
        const achievementElements = document.querySelectorAll('.achievement');
        achievementElements.forEach(el => {
            if (el.textContent.includes(id)) {
                el.classList.remove('locked');
                el.classList.add('unlocked');
            }
        });
    }

    // データ永続化
    saveProgress() {
        const data = {
            progress: this.progress,
            achievements: this.achievements,
            huffmanFrequencies: this.huffmanFrequencies
        };
        localStorage.setItem('dataCompressionProgress', JSON.stringify(data));
    }

    loadProgress() {
        const saved = localStorage.getItem('dataCompressionProgress');
        if (saved) {
            const data = JSON.parse(saved);
            this.progress = { ...this.progress, ...data.progress };
            this.achievements = data.achievements || [];
            this.huffmanFrequencies = { ...this.huffmanFrequencies, ...data.huffmanFrequencies };
        }
    }

    updateDisplay() {
        this.updateProgressDisplay();
        this.updateRunLengthEncoding();
        this.updateFrequencyTotal();
    }
}

// リサイズイベントでSVGサイズを再調整
function handleResize() {
    if (window.tool) {
        // デバウンス処理
        clearTimeout(window.tool.resizeTimeout);
        window.tool.resizeTimeout = setTimeout(() => {
            window.tool.initializeSVG();
            if (window.tool.treeSteps && window.tool.treeSteps.length > 0) {
                window.tool.updateTreeDisplay();
            }
        }, 150);
    }
}

// ツール初期化
let tool;
document.addEventListener('DOMContentLoaded', () => {
    tool = new DataCompressionTool();
    window.tool = tool; // グローバルアクセス用
    
    // リサイズイベントリスナーを追加
    window.addEventListener('resize', handleResize);
    
    // iOS Safari対応: orientationchangeイベントも追加
    window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 500); // 少し遅延して実行
    });
});