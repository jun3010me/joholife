// 論理式パーサーと評価器
class LogicEvaluator {
    constructor() {
        this.variables = new Set();
    }

    parseVariables(formula) {
        this.variables.clear();
        const matches = formula.match(/[A-Z]/g);
        if (matches) {
            matches.forEach(v => this.variables.add(v));
        }
        return Array.from(this.variables).sort();
    }

    evaluate(formula, values) {
        let expr = formula;
        
        // 変数を値に置換（バー付き変数も含む）
        for (let [variable, value] of Object.entries(values)) {
            // 通常の変数
            expr = expr.replace(new RegExp(variable, 'g'), value);
            // バー付き変数（否定）
            expr = expr.replace(new RegExp(variable + '‾', 'g'), value === 1 ? 0 : 1);
        }

        // 論理演算子を JavaScript の演算子に変換
        expr = expr.replace(/・/g, '&&');
        expr = expr.replace(/\+/g, '||');
        expr = expr.replace(/⊕/g, '!=');

        try {
            return eval(expr) ? 1 : 0;
        } catch (e) {
            throw new Error('無効な式です');
        }
    }

    generateTruthTable(formula) {
        const variables = this.parseVariables(formula);
        const rows = Math.pow(2, variables.length);
        const table = [];

        for (let i = 0; i < rows; i++) {
            const values = {};
            const row = [];
            
            // 各変数の値を設定
            for (let j = 0; j < variables.length; j++) {
                const value = (i >> (variables.length - 1 - j)) & 1;
                values[variables[j]] = value;
                row.push(value);
            }

            // 式の結果を計算
            try {
                const result = this.evaluate(formula, values);
                row.push(result);
                table.push(row);
            } catch (e) {
                throw e;
            }
        }

        return {
            variables: variables,
            table: table
        };
    }
}

const evaluator = new LogicEvaluator();
let currentCircuitVariables = [];

// 回路図生成クラス
class CircuitDiagramGenerator {
    constructor() {
        // レスポンシブな寸法設定
        this.setResponsiveDimensions();
        this.expandXOR = false;     // XOR分解モード
        this.currentLevelSpacing = null; // 動的レベル間隔
        this.currentInputSpacing = null;  // 動的入力間隔
    }

    // レスポンシブな寸法設定
    setResponsiveDimensions() {
        const isMobile = window.innerWidth <= 767;
        const isTablet = window.innerWidth <= 1023 && window.innerWidth > 767;
        
        if (isMobile) {
            this.gateWidth = 50;
            this.gateHeight = 32;
            this.gateSpacing = 60;
            this.levelSpacing = 100;
            this.inputSpacing = 45;
            this.wireLength = 20;
            this.minGateSpacing = 45;
        } else if (isTablet) {
            this.gateWidth = 55;
            this.gateHeight = 36;
            this.gateSpacing = 70;
            this.levelSpacing = 120;
            this.inputSpacing = 50;
            this.wireLength = 25;
            this.minGateSpacing = 50;
        } else {
            this.gateWidth = 60;
            this.gateHeight = 40;
            this.gateSpacing = 80;
            this.levelSpacing = 140;
            this.inputSpacing = 60;
            this.wireLength = 30;
            this.minGateSpacing = 60;
        }
    }

    // XOR分解モードの設定
    setExpandXOR(expand) {
        this.expandXOR = expand;
        // モード変更時にレベル間隔をリセット
        this.currentLevelSpacing = null;
        this.currentInputSpacing = null;
    }

    // 論理式を解析して回路構造を作成
    parseToCircuit(formula) {
        // 変数を抽出
        const variables = Array.from(new Set(formula.match(/[A-Z]/g) || [])).sort();
        
        // 式を解析してノード構造を作成
        const rootNode = this.parseExpression(formula);
        
        return {
            variables: variables,
            circuit: rootNode
        };
    }

    // 式解析（情報工学記号対応）
    parseExpression(expr) {
        expr = expr.trim();
        
        // バー付き変数の処理（NOT演算）
        const barMatch = expr.match(/^([A-Z])‾?$/);
        if (barMatch) {
            if (expr.includes('‾')) {
                return {
                    type: 'NOT',
                    inputs: [{
                        type: 'INPUT',
                        name: barMatch[1]
                    }]
                };
            } else {
                return {
                    type: 'INPUT',
                    name: barMatch[1]
                };
            }
        }

        // 括弧の処理
        if (expr.startsWith('(') && expr.endsWith(')')) {
            return this.parseExpression(expr.substring(1, expr.length - 1));
        }

        // 単一変数
        if (/^[A-Z]$/.test(expr)) {
            return {
                type: 'INPUT',
                name: expr
            };
        }

        // 二項演算子の検索（右から左へ、優先順位: +, ⊕, ・）
        let depth = 0;
        
        // まずOR（+）を探す（最も優先度が低い）
        for (let i = expr.length - 1; i >= 0; i--) {
            const char = expr[i];
            if (char === ')') depth++;
            else if (char === '(') depth--;
            else if (depth === 0 && char === '+') {
                return {
                    type: 'OR',
                    inputs: [
                        this.parseExpression(expr.substring(0, i).trim()),
                        this.parseExpression(expr.substring(i + 1).trim())
                    ]
                };
            }
        }

        // 次にXOR（⊕）を探す
        depth = 0;
        for (let i = expr.length - 1; i >= 0; i--) {
            const char = expr[i];
            if (char === ')') depth++;
            else if (char === '(') depth--;
            else if (depth === 0 && char === '⊕') {
                if (this.expandXOR) {
                    // XORを基本ゲートで分解: A⊕B = (A・B‾) + (A‾・B)
                    const leftInput = this.parseExpression(expr.substring(0, i).trim());
                    const rightInput = this.parseExpression(expr.substring(i + 1).trim());
                    
                    return {
                        type: 'OR',
                        inputs: [
                            {
                                type: 'AND',
                                inputs: [
                                    leftInput,
                                    {
                                        type: 'NOT',
                                        inputs: [rightInput]
                                    }
                                ]
                            },
                            {
                                type: 'AND',
                                inputs: [
                                    {
                                        type: 'NOT',
                                        inputs: [leftInput]
                                    },
                                    rightInput
                                ]
                            }
                        ]
                    };
                } else {
                    return {
                        type: 'XOR',
                        inputs: [
                            this.parseExpression(expr.substring(0, i).trim()),
                            this.parseExpression(expr.substring(i + 1).trim())
                        ]
                    };
                }
            }
        }

        // 最後にAND（・）を探す（最も優先度が高い）
        depth = 0;
        for (let i = expr.length - 1; i >= 0; i--) {
            const char = expr[i];
            if (char === ')') depth++;
            else if (char === '(') depth--;
            else if (depth === 0 && char === '・') {
                return {
                    type: 'AND',
                    inputs: [
                        this.parseExpression(expr.substring(0, i).trim()),
                        this.parseExpression(expr.substring(i + 1).trim())
                    ]
                };
            }
        }

        throw new Error('無効な式: ' + expr);
    }

    // 回路図のSVGを生成
    generateSVG(formula) {
        try {
            const circuit = this.parseToCircuit(formula);
            const layout = this.calculateLayout(circuit);
            
            const width = layout.width + 100;
            const height = layout.height + 100;
            
            let svg = `<svg class="circuit-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
            
            // 背景
            svg += `<rect width="${width}" height="${height}" fill="#f8f9fa" stroke="none"/>`;
            
            // 回路要素を描画
            svg += this.drawCircuit(circuit, layout);
            
            svg += '</svg>';
            return svg;
        } catch (e) {
            return `<div class="error">回路図生成エラー: ${e.message}</div>`;
        }
    }

    // 改良されたレイアウト計算（XOR分解時の配線重複回避）
    calculateLayout(circuit) {
        const positions = new Map();
        const levelNodes = new Map(); // 各レベルのノード管理
        let maxLevel = 0;
        
        // まず各ノードのレベルを計算
        const calculateLevels = (node, level = 0) => {
            if (positions.has(node)) return positions.get(node).level;

            if (node.type === 'INPUT') {
                const nodeLevel = 0;
                positions.set(node, { level: nodeLevel, processed: false, type: node.type });
                
                if (!levelNodes.has(nodeLevel)) levelNodes.set(nodeLevel, []);
                levelNodes.get(nodeLevel).push(node);
                
                return nodeLevel;
            } else {
                let maxChildLevel = 0;
                node.inputs.forEach(input => {
                    maxChildLevel = Math.max(maxChildLevel, calculateLevels(input, level + 1));
                });
                
                const nodeLevel = maxChildLevel + 1;
                maxLevel = Math.max(maxLevel, nodeLevel);
                positions.set(node, { level: nodeLevel, processed: false, type: node.type });
                
                if (!levelNodes.has(nodeLevel)) levelNodes.set(nodeLevel, []);
                levelNodes.get(nodeLevel).push(node);
                
                return nodeLevel;
            }
        };

        calculateLevels(circuit.circuit);

        // XOR分解モードでの特別な配置調整
        const adjustForXORExpansion = () => {
            if (!this.expandXOR) return;
            
            // 複雑な回路の場合はさらに間隔を拡大
            const totalNodes = Array.from(positions.keys()).length;
            let spacingMultiplier = 1.4; // 基本の拡大率
            
            if (totalNodes > 6) {
                spacingMultiplier = 1.6; // 複雑な回路ではさらに拡大
            }
            
            // NOTゲートが多い場合の間隔調整
            for (let level = 1; level <= maxLevel; level++) {
                const nodes = levelNodes.get(level) || [];
                const notGates = nodes.filter(node => node.type === 'NOT');
                
                if (notGates.length > 0) {
                    this.currentLevelSpacing = this.levelSpacing * spacingMultiplier;
                    break; // 一度設定したら全レベルに適用
                }
            }
            
            // XOR分解では垂直間隔も拡大
            this.currentInputSpacing = this.inputSpacing * 1.2;
        };

        adjustForXORExpansion();

        // 各レベルでのY座標を計算（配線重複を避けるため）
        const calculateYPositions = () => {
            // 入力ノード（レベル0）の配置
            const inputNodes = levelNodes.get(0) || [];
            const inputSpacing = this.currentInputSpacing || this.inputSpacing;
            inputNodes.forEach((node, index) => {
                const pos = positions.get(node);
                pos.x = 50;
                pos.y = 50 + index * inputSpacing;
                pos.processed = true;
            });

            // 他のレベルのノード配置
            for (let level = 1; level <= maxLevel; level++) {
                const nodes = levelNodes.get(level) || [];
                
                // 各ノードの理想的なY位置を計算（入力ノードの中央）
                nodes.forEach(node => {
                    const pos = positions.get(node);
                    const inputPositions = node.inputs.map(input => positions.get(input).y);
                    const idealY = inputPositions.reduce((sum, y) => sum + y, 0) / inputPositions.length;
                    pos.idealY = idealY;
                    
                    // XOR分解時のレベル間隔調整
                    const levelSpacing = this.currentLevelSpacing || this.levelSpacing;
                    pos.x = 50 + level * levelSpacing;
                });

                // NOTゲートを優先配置して配線クリアランス確保
                const notGates = nodes.filter(node => node.type === 'NOT');
                const otherGates = nodes.filter(node => node.type !== 'NOT');
                const sortedNodes = [...notGates, ...otherGates];

                // 理想的な位置でソートしてから実際の位置を決定
                sortedNodes.sort((a, b) => positions.get(a).idealY - positions.get(b).idealY);
                
                // 配置済みの位置を追跡
                const usedYPositions = [];
                
                sortedNodes.forEach((node, index) => {
                    const pos = positions.get(node);
                    let targetY = pos.idealY;
                    
                    // ノードタイプに応じた最小間隔
                    let minSpacing = this.minGateSpacing;
                    if (node.type === 'NOT') {
                        minSpacing = this.minGateSpacing * 2.0; // NOTゲートはさらに余裕を持たせる
                    } else if (this.expandXOR) {
                        minSpacing = this.minGateSpacing * 1.3; // XOR分解時は全体的に間隔を拡大
                    }
                    
                    // 配置済みの位置との衝突チェック
                    let adjusted = false;
                    let attempts = 0;
                    do {
                        adjusted = false;
                        for (const usedY of usedYPositions) {
                            if (Math.abs(targetY - usedY) < minSpacing) {
                                // 上下どちらに移動するか決定（より空いている方向へ）
                                const spaceAbove = usedYPositions.filter(y => y < targetY).length;
                                const spaceBelow = usedYPositions.filter(y => y > targetY).length;
                                
                                if (spaceAbove <= spaceBelow) {
                                    targetY = usedY - minSpacing;
                                } else {
                                    targetY = usedY + minSpacing;
                                }
                                adjusted = true;
                                break;
                            }
                        }
                        attempts++;
                    } while (adjusted && attempts < 10);
                    
                    // 最小Y位置の制限
                    targetY = Math.max(targetY, 50);
                    
                    pos.y = targetY;
                    pos.processed = true;
                    usedYPositions.push(targetY);
                });
            }
        };

        calculateYPositions();

        // 全体のサイズを計算
        let maxY = 50;
        let maxX = 50;
        positions.forEach(pos => {
            maxY = Math.max(maxY, pos.y);
            maxX = Math.max(maxX, pos.x);
        });

        // レスポンシブなパディング設定
        const isMobile = window.innerWidth <= 767;
        const isTablet = window.innerWidth <= 1023 && window.innerWidth > 767;
        
        let widthPadding, heightPadding;
        if (isMobile) {
            widthPadding = 80;
            heightPadding = 60;
        } else if (isTablet) {
            widthPadding = 100;
            heightPadding = 80;
        } else {
            widthPadding = 150;
            heightPadding = 100;
        }

        return {
            positions: positions,
            width: maxX + widthPadding,
            height: maxY + heightPadding
        };
    }

    // 回路描画
    drawCircuit(circuit, layout) {
        let svg = '';
        const drawn = new Set();

        const drawNode = (node) => {
            if (drawn.has(node)) return '';
            drawn.add(node);

            const pos = layout.positions.get(node);
            let result = '';

            if (node.type === 'INPUT') {
                // 入力端子
                result += `<circle cx="${pos.x}" cy="${pos.y}" r="8" fill="#4fd1c7" stroke="#2d3748" stroke-width="2"/>`;
                result += `<text x="${pos.x}" y="${pos.y - 15}" class="input-label">${node.name}</text>`;
            } else {
                // ゲート描画
                result += this.drawGate(node.type, pos.x, pos.y);
                
                // 入力線の描画（改良版）
                node.inputs.forEach((input, index) => {
                    result += drawNode(input);
                    const inputPos = layout.positions.get(input);
                    
                    // 入力ピンの位置を計算
                    const inputPinSpacing = 20; // 入力ピン間の間隔
                    const totalInputHeight = (node.inputs.length - 1) * inputPinSpacing;
                    const startY = pos.y - totalInputHeight / 2;
                    const targetY = startY + index * inputPinSpacing;
                    
                    const startX = inputPos.x + (input.type === 'INPUT' ? 8 : this.gateWidth/2);
                    const endX = pos.x - this.gateWidth/2;
                    
                    result += this.drawWire(startX, inputPos.y, endX, targetY);
                });
            }

            return result;
        };

        svg += drawNode(circuit.circuit);

        // 出力線
        const rootPos = layout.positions.get(circuit.circuit);
        if (circuit.circuit.type !== 'INPUT') {
            svg += this.drawWire(rootPos.x + this.gateWidth/2, rootPos.y, rootPos.x + this.gateWidth/2 + 30, rootPos.y);
            svg += `<text x="${rootPos.x + this.gateWidth/2 + 35}" y="${rootPos.y + 5}" class="output-label">出力</text>`;
        }

        return svg;
    }

    // ゲート描画
    drawGate(type, x, y) {
        const halfWidth = this.gateWidth / 2;
        const halfHeight = this.gateHeight / 2;
        let svg = '';

        switch (type) {
            case 'AND':
                svg += `<path d="M ${x - halfWidth} ${y - halfHeight} L ${x} ${y - halfHeight} Q ${x + halfWidth} ${y - halfHeight} ${x + halfWidth} ${y} Q ${x + halfWidth} ${y + halfHeight} ${x} ${y + halfHeight} L ${x - halfWidth} ${y + halfHeight} Z" fill="#fef5e7" stroke="#744210" stroke-width="2"/>`;
                svg += `<text x="${x}" y="${y + 4}" class="gate-label">AND</text>`;
                break;
            case 'OR':
                svg += `<path d="M ${x - halfWidth} ${y - halfHeight} Q ${x} ${y - halfHeight + 10} ${x + halfWidth} ${y} Q ${x} ${y + halfHeight - 10} ${x - halfWidth} ${y + halfHeight} Q ${x - halfWidth + 15} ${y} ${x - halfWidth} ${y - halfHeight} Z" fill="#e6fffa" stroke="#234e52" stroke-width="2"/>`;
                svg += `<text x="${x}" y="${y + 4}" class="gate-label">OR</text>`;
                break;
            case 'NOT':
                svg += `<path d="M ${x - halfWidth} ${y - halfHeight} L ${x + halfWidth - 10} ${y} L ${x - halfWidth} ${y + halfHeight} Z" fill="#e9d8fd" stroke="#553c9a" stroke-width="2"/>`;
                svg += `<circle cx="${x + halfWidth - 5}" cy="${y}" r="5" fill="white" stroke="#553c9a" stroke-width="2"/>`;
                svg += `<text x="${x - 5}" y="${y + 4}" class="gate-label">NOT</text>`;
                break;
            case 'XOR':
                svg += `<path d="M ${x - halfWidth} ${y - halfHeight} Q ${x} ${y - halfHeight + 10} ${x + halfWidth} ${y} Q ${x} ${y + halfHeight - 10} ${x - halfWidth} ${y + halfHeight} Q ${x - halfWidth + 15} ${y} ${x - halfWidth} ${y - halfHeight} Z" fill="#fed7d7" stroke="#c53030" stroke-width="2"/>`;
                svg += `<path d="M ${x - halfWidth + 8} ${y - halfHeight + 5} Q ${x - halfWidth + 20} ${y} ${x - halfWidth + 8} ${y + halfHeight - 5}" fill="none" stroke="#c53030" stroke-width="2"/>`;
                svg += `<text x="${x}" y="${y + 4}" class="gate-label">XOR</text>`;
                break;
        }

        return svg;
    }

    // 改良された配線描画（XOR分解時のゲート重複回避強化版）
    drawWire(x1, y1, x2, y2, wireId = null) {
        const yDiff = Math.abs(y1 - y2);
        const xDiff = Math.abs(x2 - x1);
        
        if (yDiff < 5) {
            // 直線配線
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wire"/>`;
        } else if (xDiff < 20) {
            // 垂直に近い場合は直接配線
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wire"/>`;
        } else {
            // XOR分解モードでの配線調整（強化版）
            if (this.expandXOR) {
                // より保守的な配線経路でゲート回避を強化
                const firstBendX = x1 + (x2 - x1) * 0.2;  // より早く曲がる
                const secondBendX = x1 + (x2 - x1) * 0.8; // より遅く曲がる
                
                // Y方向の変化に応じて配線パターンを選択
                if (yDiff > 100) {
                    // 大きな変化：3段階配線
                    const firstMidY = y1 + (y2 - y1) * 0.3;
                    const secondMidY = y1 + (y2 - y1) * 0.7;
                    const midX = x1 + (x2 - x1) * 0.5;
                    return `<path d="M ${x1} ${y1} L ${firstBendX} ${y1} L ${firstBendX} ${firstMidY} L ${midX} ${firstMidY} L ${midX} ${secondMidY} L ${secondBendX} ${secondMidY} L ${secondBendX} ${y2} L ${x2} ${y2}" class="wire" fill="none"/>`;
                } else if (yDiff > 50) {
                    // 中程度の変化：2段階配線
                    const midY = y1 + (y2 - y1) * 0.5;
                    return `<path d="M ${x1} ${y1} L ${firstBendX} ${y1} L ${firstBendX} ${midY} L ${secondBendX} ${midY} L ${secondBendX} ${y2} L ${x2} ${y2}" class="wire" fill="none"/>`;
                } else {
                    // 小さな変化：シンプルな迂回
                    return `<path d="M ${x1} ${y1} L ${firstBendX} ${y1} L ${secondBendX} ${y2} L ${x2} ${y2}" class="wire" fill="none"/>`;
                }
            } else {
                // 標準モードの配線
                const midX = x1 + (x2 - x1) * 0.6;
                
                if (yDiff > 60) {
                    const quarterX = x1 + (x2 - x1) * 0.3;
                    const threeQuarterX = x1 + (x2 - x1) * 0.8;
                    return `<path d="M ${x1} ${y1} L ${quarterX} ${y1} L ${threeQuarterX} ${y2} L ${x2} ${y2}" class="wire" fill="none"/>`;
                } else {
                    return `<path d="M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}" class="wire" fill="none"/>`;
                }
            }
        }
    }

    // 配線の衝突検出と回避
    calculateWirePath(startX, startY, endX, endY, existingWires = []) {
        // 基本的な配線パス
        const midX = startX + (endX - startX) * 0.6;
        
        // 他の配線との交差をチェック
        const proposedPath = [
            { x: startX, y: startY },
            { x: midX, y: startY },
            { x: midX, y: endY },
            { x: endX, y: endY }
        ];

        // 交差がある場合の迂回路計算（簡易版）
        let hasIntersection = false;
        for (const wire of existingWires) {
            if (this.doLinesIntersect(proposedPath, wire)) {
                hasIntersection = true;
                break;
            }
        }

        if (hasIntersection) {
            // 迂回路を作成
            const offsetY = startY < endY ? 20 : -20;
            const detourMidX = startX + (endX - startX) * 0.4;
            return `<path d="M ${startX} ${startY} L ${detourMidX} ${startY} L ${detourMidX} ${startY + offsetY} L ${midX} ${startY + offsetY} L ${midX} ${endY} L ${endX} ${endY}" class="wire" fill="none"/>`;
        }

        return this.drawWire(startX, startY, endX, endY);
    }

    // 線分交差判定（簡易版）
    doLinesIntersect(path1, path2) {
        // 簡単な重複チェック - より高度な実装に置き換え可能
        return false;
    }
}

const circuitGenerator = new CircuitDiagramGenerator();

function generateTruthTable() {
    const formula = document.getElementById('formula').value.trim();
    const resultDiv = document.getElementById('truthTableResult');

    if (!formula) {
        resultDiv.innerHTML = '<div class="error">論理式を入力してください</div>';
        return;
    }

    try {
        const result = evaluator.generateTruthTable(formula);
        let html = '<table><tr>';
        
        // ヘッダー
        result.variables.forEach(v => {
            html += `<th>${v}</th>`;
        });
        html += `<th>${formula}</th></tr>`;

        // データ行
        result.table.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        });

        html += '</table>';
        resultDiv.innerHTML = html;
    } catch (e) {
        resultDiv.innerHTML = `<div class="error">エラー: ${e.message}</div>`;
    }
}


function toggleInput(variable, event) {
    // テキスト選択とデフォルト動作を防止
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const element = document.getElementById(`input-${variable}`);
    const currentValue = element.textContent.includes('1') ? 0 : 1;
    
    element.textContent = `${variable}: ${currentValue}`;
    element.classList.toggle('active', currentValue === 1);
    
    // 選択状態をクリア
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    } else if (document.selection) {
        document.selection.empty();
    }
    
    updateCircuitOutput();
}

function updateCircuitOutput() {
    const formula = document.getElementById('formula').value.trim();
    const outputDiv = document.getElementById('circuitOutput');
    
    if (!formula || currentCircuitVariables.length === 0) return;

    const values = {};
    currentCircuitVariables.forEach(variable => {
        const element = document.getElementById(`input-${variable}`);
        values[variable] = element.textContent.includes('1') ? 1 : 0;
    });

    try {
        const result = evaluator.evaluate(formula, values);
        outputDiv.innerHTML = `<h4>出力: <span style="color: ${result ? '#38a169' : '#e53e3e'}; font-size: 1.5em;">${result}</span></h4>`;
        
        // 回路表示を更新
        const circuitDisplay = document.getElementById('circuitDisplay');
        let circuitHtml = `<div><h4>現在の状態: ${formula}</h4>`;
        currentCircuitVariables.forEach(variable => {
            const value = values[variable];
            circuitHtml += `<span class="gate" style="background: ${value ? '#38a169' : '#e53e3e'}">${variable}: ${value}</span>`;
        });
        circuitHtml += `<span class="gate" style="background: ${result ? '#38a169' : '#e53e3e'}; font-size: 1.2em;">出力: ${result}</span></div>`;
        circuitDisplay.innerHTML = circuitHtml;
    } catch (e) {
        outputDiv.innerHTML = `<div class="error">計算エラー: ${e.message}</div>`;
    }
}

const quizQuestions = [
    {
        question: "A=1, B=0のとき、A・B の結果は？",
        options: ["0", "1"],
        correct: 0,
        explanation: "AND演算（論理積）では両方が1のときだけ結果が1になります。"
    },
    {
        question: "A=1, B=0のとき、A+B の結果は？",
        options: ["0", "1"],
        correct: 1,
        explanation: "OR演算（論理和）では少なくとも一方が1なら結果が1になります。"
    },
    {
        question: "A=1のとき、A‾ の結果は？",
        options: ["0", "1"],
        correct: 0,
        explanation: "NOT演算（否定）では入力を反転します。1の反転は0です。"
    },
    {
        question: "A=1, B=1のとき、A⊕B の結果は？",
        options: ["0", "1"],
        correct: 0,
        explanation: "XOR演算（排他的論理和）では入力が異なるときだけ1になります。同じなら0です。"
    },
    {
        question: "A=0, B=1のとき、A・B‾ の結果は？",
        options: ["0", "1"],
        correct: 0,
        explanation: "まずB‾=0、次にA・B‾=0・0=0となります。"
    },
    {
        question: "A=1, B=0, C=1のとき、(A・B)+C の結果は？",
        options: ["0", "1"],
        correct: 1,
        explanation: "A・B=1・0=0、次に(A・B)+C=0+1=1となります。"
    }
];

let currentQuiz = null;

function generateQuiz() {
    const randomIndex = Math.floor(Math.random() * quizQuestions.length);
    currentQuiz = quizQuestions[randomIndex];
    
    const container = document.getElementById('quizContainer');
    let html = `
        <div class="quiz-question">
            <h3>問題: ${currentQuiz.question}</h3>
            <div class="quiz-options">
    `;
    
    currentQuiz.options.forEach((option, index) => {
        html += `
            <label>
                <input type="radio" name="quiz" value="${index}">
                ${option}
            </label>
        `;
    });
    
    html += `
            </div>
            <button onclick="checkAnswer()">回答チェック</button>
            <div id="quizResult"></div>
        </div>
        <button onclick="generateQuiz()">新しい問題を生成</button>
    `;
    
    container.innerHTML = html;
}

function checkAnswer() {
    const selected = document.querySelector('input[name="quiz"]:checked');
    const resultDiv = document.getElementById('quizResult');
    
    if (!selected) {
        resultDiv.innerHTML = '<div class="error">選択肢を選んでください</div>';
        return;
    }
    
    const selectedValue = parseInt(selected.value);
    const isCorrect = selectedValue === currentQuiz.correct;
    
    const resultClass = isCorrect ? 'success' : 'error';
    const resultText = isCorrect ? '正解！' : '不正解';
    
    resultDiv.innerHTML = `
        <div class="${resultClass}">
            <strong>${resultText}</strong><br>
            ${currentQuiz.explanation}
        </div>
    `;
}

// アクティブな入力フィールドを追跡
let lastFocusedInput = null;

// 全ての入力フィールドにフォーカスイベントを追加
document.addEventListener('DOMContentLoaded', function() {
    // 入力フィールドのフォーカス追跡
    document.addEventListener('focusin', function(e) {
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
            lastFocusedInput = e.target;
        }
    });
});

// アクティブな入力フィールドを取得
function getActiveInput() {
    // 現在フォーカスされている入力があればそれを返す
    const focused = document.activeElement;
    if (focused && focused.tagName === 'INPUT' && focused.type === 'text') {
        return focused;
    }
    
    // 最後にフォーカスされた入力があればそれを返す
    if (lastFocusedInput) {
        return lastFocusedInput;
    }
    
    // デフォルトは現在のモードに応じて決定
    const mode = document.querySelector('input[name="inputMode"]:checked').value;
    if (mode === 'single') {
        return document.getElementById('formula');
    } else {
        return document.getElementById('output1');
    }
}

// アクティブな入力フィールドにテキストを挿入
function insertTextToActiveInput(text) {
    const input = getActiveInput();
    if (!input) return;
    
    const cursorPos = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPos);
    const textAfter = input.value.substring(input.selectionEnd);
    
    input.value = textBefore + text + textAfter;
    input.focus();
    input.setSelectionRange(cursorPos + text.length, cursorPos + text.length);
    lastFocusedInput = input;
}

// アクティブな入力フィールドにバー付き変数を挿入
function insertVariableWithBarToActiveInput() {
    const input = getActiveInput();
    if (!input) return;
    
    const cursorPos = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPos);
    const textAfter = input.value.substring(input.selectionEnd);
    
    // 直前の文字が変数（A-Z）の場合、バーを追加
    if (textBefore.length > 0 && /[A-Z]$/.test(textBefore)) {
        input.value = textBefore + '‾' + textAfter;
        input.focus();
        input.setSelectionRange(cursorPos + 1, cursorPos + 1);
    } else {
        // そうでなければ変数選択ダイアログまたはデフォルト変数を使用
        const variable = prompt('否定する変数を入力してください (A, B, C, D):', 'A');
        if (variable && /^[A-D]$/.test(variable.toUpperCase())) {
            const barredVar = variable.toUpperCase() + '‾';
            input.value = textBefore + barredVar + textAfter;
            input.focus();
            input.setSelectionRange(cursorPos + barredVar.length, cursorPos + barredVar.length);
        }
    }
    lastFocusedInput = input;
}

// アクティブな入力フィールドから最後の文字を削除
function deleteLastCharFromActiveInput() {
    const input = getActiveInput();
    if (!input) return;
    
    if (input.value.length > 0) {
        const cursorPos = input.selectionStart;
        if (cursorPos > 0) {
            const textBefore = input.value.substring(0, cursorPos - 1);
            const textAfter = input.value.substring(input.selectionEnd);
            input.value = textBefore + textAfter;
            input.focus();
            input.setSelectionRange(cursorPos - 1, cursorPos - 1);
        }
    }
    lastFocusedInput = input;
}

// 後方互換性のためのレガシー関数
function insertText(inputId, text) {
    const input = document.getElementById(inputId);
    const cursorPos = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPos);
    const textAfter = input.value.substring(input.selectionEnd);
    
    input.value = textBefore + text + textAfter;
    input.focus();
    input.setSelectionRange(cursorPos + text.length, cursorPos + text.length);
}

function insertVariableWithBar(inputId) {
    const input = document.getElementById(inputId);
    const cursorPos = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPos);
    const textAfter = input.value.substring(input.selectionEnd);
    
    if (textBefore.length > 0 && /[A-Z]$/.test(textBefore)) {
        input.value = textBefore + '‾' + textAfter;
        input.focus();
        input.setSelectionRange(cursorPos + 1, cursorPos + 1);
    } else {
        const variable = prompt('否定する変数を入力してください (A, B, C, D):', 'A');
        if (variable && /^[A-D]$/.test(variable.toUpperCase())) {
            const barredVar = variable.toUpperCase() + '‾';
            input.value = textBefore + barredVar + textAfter;
            input.focus();
            input.setSelectionRange(cursorPos + barredVar.length, cursorPos + barredVar.length);
        }
    }
}

function clearInput(inputId) {
    const input = document.getElementById(inputId);
    input.value = '';
    input.focus();
}

function deleteLastChar(inputId) {
    const input = document.getElementById(inputId);
    if (input.value.length > 0) {
        const cursorPos = input.selectionStart;
        if (cursorPos > 0) {
            const textBefore = input.value.substring(0, cursorPos - 1);
            const textAfter = input.value.substring(input.selectionEnd);
            input.value = textBefore + textAfter;
            input.focus();
            input.setSelectionRange(cursorPos - 1, cursorPos - 1);
        }
    }
}

// 入力モード切り替え機能
function toggleInputMode() {
    const mode = document.querySelector('input[name="inputMode"]:checked').value;
    const singleMode = document.getElementById('singleOutputMode');
    const multipleMode = document.getElementById('multipleOutputMode');
    
    if (mode === 'single') {
        singleMode.style.display = 'block';
        multipleMode.style.display = 'none';
    } else {
        singleMode.style.display = 'none';
        multipleMode.style.display = 'block';
    }
}

// 出力式追加機能
let outputCount = 2;
function addOutputFormula() {
    outputCount++;
    const container = document.getElementById('outputFormulas');
    const newOutput = document.createElement('div');
    newOutput.className = 'output-formula-group';
    newOutput.innerHTML = `
        <label for="output${outputCount}">出力${outputCount}:</label>
        <div class="input-display">
            <input type="text" id="output${outputCount}" placeholder="論理式を入力">
            <button class="input-btn clear" onclick="clearInput('output${outputCount}')">クリア</button>
            <button class="input-btn" onclick="removeOutput(this)" style="background: #e53e3e; color: white;">削除</button>
        </div>
    `;
    container.appendChild(newOutput);
}

// 出力削除機能
function removeOutput(button) {
    const outputGroup = button.closest('.output-formula-group');
    outputGroup.remove();
}

// プリセット読み込み機能
function loadHalfAdder() {
    document.getElementById('output1').value = 'A⊕B';
    document.getElementById('output2').value = 'A・B';
    document.querySelector('input[name="inputMode"][value="multiple"]').checked = true;
    toggleInputMode();
}

function loadFullAdder() {
    // 既存の出力をクリア
    const container = document.getElementById('outputFormulas');
    container.innerHTML = `
        <div class="output-formula-group">
            <label for="output1">Sum:</label>
            <div class="input-display">
                <input type="text" id="output1" value="A⊕B⊕C">
                <button class="input-btn clear" onclick="clearInput('output1')">クリア</button>
            </div>
        </div>
        <div class="output-formula-group">
            <label for="output2">Carry:</label>
            <div class="input-display">
                <input type="text" id="output2" value="A・B + (A⊕B)・C">
                <button class="input-btn clear" onclick="clearInput('output2')">クリア</button>
            </div>
        </div>
    `;
    outputCount = 2;
    document.querySelector('input[name="inputMode"][value="multiple"]').checked = true;
    toggleInputMode();
}

// 統合論理式解析機能（拡張版）
function analyzeFormula() {
    // 画面サイズ変更時にレスポンシブ寸法を更新
    circuitGenerator.setResponsiveDimensions();
    
    const mode = document.querySelector('input[name="inputMode"]:checked').value;
    
    if (mode === 'single') {
        analyzeSingleOutput();
    } else {
        analyzeMultipleOutputs();
    }
}

// 単一出力解析
function analyzeSingleOutput() {
    const formula = document.getElementById('formula').value.trim();
    
    if (!formula) {
        alert('論理式を入力してください');
        return;
    }

    // XORモードの設定
    const expandMode = document.getElementById('expandXORMode').checked;
    circuitGenerator.setExpandXOR(expandMode);

    try {
        // 複数出力結果を非表示
        document.getElementById('multipleOutputResults').style.display = 'none';

        // 1. 回路図の生成
        const svg = circuitGenerator.generateSVG(formula);
        document.getElementById('circuitSvg').innerHTML = svg;
        document.getElementById('circuitDiagramSection').style.display = 'block';

        // 2. 真理値表の生成
        generateTruthTable();
        document.getElementById('truthTableSection').style.display = 'block';

        // 3. シミュレーターのセットアップ
        setupCircuitSimulator();
        document.getElementById('simulatorSection').style.display = 'block';

        // スムーズスクロール
        document.getElementById('circuitDiagramSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });

    } catch (error) {
        alert('論理式の解析中にエラーが発生しました: ' + error.message);
    }
}

// 複数出力解析
function analyzeMultipleOutputs() {
    const outputs = [];
    const outputLabels = [];
    
    // 全ての出力式を収集
    const outputInputs = document.querySelectorAll('#outputFormulas input[type="text"]');
    outputInputs.forEach((input, index) => {
        if (input.value.trim()) {
            outputs.push(input.value.trim());
            const label = input.previousElementSibling ? 
                input.previousElementSibling.textContent.replace(':', '') : 
                `出力${index + 1}`;
            outputLabels.push(label);
        }
    });

    if (outputs.length === 0) {
        alert('少なくとも1つの出力式を入力してください');
        return;
    }

    try {
        // 単一出力結果を非表示
        document.getElementById('truthTableSection').style.display = 'none';
        document.getElementById('circuitDiagramSection').style.display = 'none';
        document.getElementById('simulatorSection').style.display = 'none';

        // XORモードの設定
        const expandMode = document.getElementById('expandXORMode').checked;
        circuitGenerator.setExpandXOR(expandMode);

        // 複数出力の解析
        generateMultipleOutputTruthTable(outputs, outputLabels);
        generateMultipleOutputCircuits(outputs, outputLabels);
        setupMultipleOutputSimulator(outputs, outputLabels);

        document.getElementById('multipleOutputResults').style.display = 'block';

        // スムーズスクロール
        document.getElementById('multipleOutputResults').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });

    } catch (error) {
        alert('複数出力回路の解析中にエラーが発生しました: ' + error.message);
    }
}

// シミュレーター専用のセットアップ関数
function setupCircuitSimulator() {
    const formula = document.getElementById('formula').value.trim();
    
    if (!formula) return;

    try {
        currentCircuitVariables = evaluator.parseVariables(formula);
        const inputsDiv = document.getElementById('circuitInputs');
        
        let html = '<h4>入力値を切り替えてください：</h4>';
        currentCircuitVariables.forEach(variable => {
            html += `<span class="input-toggle" id="input-${variable}" onclick="toggleInput('${variable}', event)" onmousedown="return false;">${variable}: 0</span>`;
        });
        
        inputsDiv.innerHTML = html;
        updateCircuitOutput();
    } catch (e) {
        console.error('シミュレーターセットアップエラー:', e);
    }
}

// 複数出力用の解析関数
function generateMultipleOutputTruthTable(outputs, outputLabels) {
    // 全ての出力から変数を抽出
    let allVariables = new Set();
    outputs.forEach(formula => {
        const variables = evaluator.parseVariables(formula);
        variables.forEach(v => allVariables.add(v));
    });
    
    const variables = Array.from(allVariables).sort();
    const rows = Math.pow(2, variables.length);
    
    let html = '<table><tr>';
    
    // 入力変数のヘッダー
    variables.forEach(v => {
        html += `<th>${v}</th>`;
    });
    
    // 出力のヘッダー
    outputLabels.forEach(label => {
        html += `<th style="background: #667eea;">${label}</th>`;
    });
    html += '</tr>';

    // データ行
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        const values = {};
        
        // 入力変数の値
        for (let j = 0; j < variables.length; j++) {
            const value = (i >> (variables.length - 1 - j)) & 1;
            values[variables[j]] = value;
            html += `<td>${value}</td>`;
        }
        
        // 各出力の計算結果
        outputs.forEach(formula => {
            try {
                const result = evaluator.evaluate(formula, values);
                html += `<td style="background: ${result ? '#c6f6d5' : '#fed7d7'};">${result}</td>`;
            } catch (e) {
                html += `<td style="background: #fed7d7;">エラー</td>`;
            }
        });
        
        html += '</tr>';
    }

    html += '</table>';
    document.getElementById('multipleOutputTruthTable').innerHTML = html;
}

function generateMultipleOutputCircuits(outputs, outputLabels) {
    let html = '';
    
    outputs.forEach((formula, index) => {
        const svg = circuitGenerator.generateSVG(formula);
        html += `
            <div style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
                <h4>${outputLabels[index]}: ${formula}</h4>
                ${svg}
            </div>
        `;
    });
    
    document.getElementById('multipleOutputCircuits').innerHTML = html;
}

function setupMultipleOutputSimulator(outputs, outputLabels) {
    // 全ての出力から変数を抽出
    let allVariables = new Set();
    outputs.forEach(formula => {
        const variables = evaluator.parseVariables(formula);
        variables.forEach(v => allVariables.add(v));
    });
    
    const variables = Array.from(allVariables).sort();
    
    let html = '<h4>入力値を切り替えてください：</h4>';
    variables.forEach(variable => {
        html += `<span class="input-toggle" id="multi-input-${variable}" onclick="toggleMultipleInput('${variable}', event)" onmousedown="return false;">${variable}: 0</span>`;
    });
    
    document.getElementById('multipleOutputInputs').innerHTML = html;
    
    // 出力表示の更新
    updateMultipleOutputDisplay(outputs, outputLabels, variables);
}

function toggleMultipleInput(variable, event) {
    // テキスト選択とデフォルト動作を防止
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const element = document.getElementById(`multi-input-${variable}`);
    const currentValue = element.textContent.includes('1') ? 0 : 1;
    
    element.textContent = `${variable}: ${currentValue}`;
    element.classList.toggle('active', currentValue === 1);
    
    // 選択状態をクリア
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    } else if (document.selection) {
        document.selection.empty();
    }
    
    // 複数出力の更新をトリガー
    updateMultipleOutputDisplay();
}

function updateMultipleOutputDisplay(outputs = null, outputLabels = null, variables = null) {
    if (!outputs) {
        // 現在の出力情報を再取得
        outputs = [];
        outputLabels = [];
        const outputInputs = document.querySelectorAll('#outputFormulas input[type="text"]');
        outputInputs.forEach((input, index) => {
            if (input.value.trim()) {
                outputs.push(input.value.trim());
                const label = input.previousElementSibling ? 
                    input.previousElementSibling.textContent.replace(':', '') : 
                    `出力${index + 1}`;
                outputLabels.push(label);
            }
        });
        
        let allVariables = new Set();
        outputs.forEach(formula => {
            const vars = evaluator.parseVariables(formula);
            vars.forEach(v => allVariables.add(v));
        });
        variables = Array.from(allVariables).sort();
    }
    
    const values = {};
    variables.forEach(variable => {
        const element = document.getElementById(`multi-input-${variable}`);
        values[variable] = element.textContent.includes('1') ? 1 : 0;
    });

    let html = '<div><h4>現在の出力状態：</h4>';
    
    outputs.forEach((formula, index) => {
        try {
            const result = evaluator.evaluate(formula, values);
            html += `<div style="margin: 10px 0; padding: 10px; border-radius: 5px; background: ${result ? '#c6f6d5' : '#fed7d7'};">`;
            html += `<strong>${outputLabels[index]}</strong>: ${formula} = <span style="font-size: 1.2em; font-weight: bold;">${result}</span>`;
            html += `</div>`;
        } catch (e) {
            html += `<div style="margin: 10px 0; padding: 10px; border-radius: 5px; background: #fed7d7;">`;
            html += `<strong>${outputLabels[index]}</strong>: エラー`;
            html += `</div>`;
        }
    });
    
    html += '</div>';
    document.getElementById('multipleOutputDisplay').innerHTML = html;
}

// 初期化時に最初の問題を生成
window.onload = function() {
    generateQuiz();
};