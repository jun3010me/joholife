// 16進数学習サイト用JavaScript

class HexConverter {
    constructor() {
        this.animationSpeed = 1500;
        this.isAnimating = false;
        this.isPaused = false;
        this.currentAnimation = null;
        this.practiceStats = {
            correct: 0,
            total: 0
        };
        
        this.initializeEventListeners();
        this.updateSpeedDisplay();
    }

    initializeEventListeners() {
        // 2進数→16進数変換
        document.getElementById('convertBinaryToHexBtn').addEventListener('click', () => {
            this.convertBinaryToHex();
        });

        // 16進数→2進数変換
        document.getElementById('convertHexToBinaryBtn').addEventListener('click', () => {
            this.convertHexToBinary();
        });

        // 10進数→16進数変換（2進数経由）
        document.getElementById('convertDecimalToHexBtn').addEventListener('click', () => {
            this.convertDecimalToHex();
        });

        // 16進数→10進数変換（2進数経由）
        document.getElementById('convertHexToDecimalBtn').addEventListener('click', () => {
            this.convertHexToDecimal();
        });

        // アニメーション制御
        document.getElementById('pauseAllBtn').addEventListener('click', () => {
            this.pauseAnimation();
        });

        document.getElementById('resumeAllBtn').addEventListener('click', () => {
            this.resumeAnimation();
        });

        document.getElementById('resetAllBtn').addEventListener('click', () => {
            this.resetAllAnimations();
        });

        // 速度制御
        document.getElementById('globalAnimationSpeed').addEventListener('input', (e) => {
            this.animationSpeed = parseInt(e.target.value);
            this.updateSpeedDisplay();
        });

        // 練習問題
        document.getElementById('generateHexProblemBtn').addEventListener('click', () => {
            this.generatePracticeProblPem();
        });

        document.getElementById('checkHexAnswerBtn').addEventListener('click', () => {
            this.checkAnswer();
        });

        document.getElementById('hexUserAnswer').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkAnswer();
            }
        });

        // 入力フィールドのリアルタイム検証
        this.setupInputValidation();

        // 例集のクリックイベント
        this.setupExamplesInteraction();
    }

    setupInputValidation() {
        const binaryInput = document.getElementById('binaryToHexInput');
        binaryInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^01]/g, '');
        });

        const hexInputs = ['hexToBinaryInput', 'hexToDecimalInput'];
        hexInputs.forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
            });
        });
    }

    setupExamplesInteraction() {
        const examples = document.querySelectorAll('.example-item');
        examples.forEach(example => {
            example.addEventListener('click', () => {
                const hex = example.dataset.hex;
                const decimal = example.dataset.decimal;
                const binary = example.dataset.binary;
                
                this.showExampleConversion(hex, decimal, binary);
            });
        });
    }

    showExampleConversion(hex, decimal, binary) {
        const modal = document.createElement('div');
        modal.className = 'conversion-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>変換例: ${hex} (16進数)</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="conversion-example">
                        <div class="conversion-row">
                            <span class="label">16進数:</span>
                            <span class="value hex">${hex}</span>
                        </div>
                        <div class="conversion-row">
                            <span class="label">10進数:</span>
                            <span class="value decimal">${decimal}</span>
                        </div>
                        <div class="conversion-row">
                            <span class="label">2進数:</span>
                            <span class="value binary">${binary}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updateSpeedDisplay() {
        const display = document.getElementById('globalSpeedDisplay');
        display.textContent = `${(this.animationSpeed / 1000).toFixed(1)}秒`;
    }

    async convertBinaryToHex() {
        const input = document.getElementById('binaryToHexInput').value.trim();
        if (!input) {
            alert('2進数を入力してください');
            return;
        }

        if (!/^[01]+$/.test(input)) {
            alert('2進数は0と1のみで入力してください');
            return;
        }

        this.isAnimating = true;
        const display = document.getElementById('binaryToHexDisplay');
        display.classList.add('active');
        
        try {
            await this.animateBinaryToHexConversion(input);
        } catch (error) {
            console.error('変換エラー:', error);
        } finally {
            this.isAnimating = false;
        }
    }

    async animateBinaryToHexConversion(binary) {
        const groupingDiv = document.getElementById('binaryGrouping');
        const stepsDiv = document.getElementById('binaryToHexSteps');
        const resultDiv = document.getElementById('binaryToHexResult');

        // リセット
        groupingDiv.innerHTML = '';
        stepsDiv.innerHTML = '';
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('show');

        // 2進数を4桁ずつにグループ化
        const paddedBinary = binary.padStart(Math.ceil(binary.length / 4) * 4, '0');
        const groups = [];
        
        for (let i = 0; i < paddedBinary.length; i += 4) {
            groups.push(paddedBinary.substr(i, 4));
        }

        // グループ化の表示
        groupingDiv.innerHTML = '<h4>ステップ1: 2進数を4桁ずつグループ化</h4>';
        const groupContainer = document.createElement('div');
        groupContainer.className = 'groups-container';
        
        for (let i = 0; i < groups.length; i++) {
            const group = document.createElement('div');
            group.className = 'binary-group';
            group.innerHTML = `
                <div class="binary-digits">${groups[i]}</div>
                <div class="hex-digit" style="opacity: 0;"></div>
            `;
            groupContainer.appendChild(group);
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed / 2);
            }
        }
        
        groupingDiv.appendChild(groupContainer);

        // 各グループを16進数に変換
        stepsDiv.innerHTML = '<h4>ステップ2: 各グループを16進数に変換</h4>';
        
        let hexResult = '';
        
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const decimal = parseInt(group, 2);
            const hex = decimal.toString(16).toUpperCase();
            
            // グループをハイライト
            const groupElements = groupContainer.children;
            groupElements[i].classList.add('highlight');
            
            // 変換ステップを表示
            const step = document.createElement('div');
            step.className = 'calculation-step';
            step.innerHTML = `
                <div>${group} (2進数) = ${decimal} (10進数) = ${hex} (16進数)</div>
            `;
            stepsDiv.appendChild(step);
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed);
            }
            
            step.classList.add('active');
            
            // 16進数の桁を表示
            const hexDigitElement = groupElements[i].querySelector('.hex-digit');
            hexDigitElement.textContent = hex;
            hexDigitElement.style.opacity = '1';
            
            hexResult += hex;
            
            // ハイライト解除
            groupElements[i].classList.remove('highlight');
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed / 2);
            }
        }

        // 最終結果
        resultDiv.innerHTML = `
            <div>変換結果: ${binary} (2進数) = ${hexResult} (16進数)</div>
        `;
        resultDiv.classList.add('show');
    }

    async convertHexToBinary() {
        const input = document.getElementById('hexToBinaryInput').value.trim().toUpperCase();
        if (!input) {
            alert('16進数を入力してください');
            return;
        }

        if (!/^[0-9A-F]+$/.test(input)) {
            alert('16進数は0-9、A-Fで入力してください');
            return;
        }

        this.isAnimating = true;
        const display = document.getElementById('hexToBinaryDisplay');
        display.classList.add('active');
        
        try {
            await this.animateHexToBinaryConversion(input);
        } catch (error) {
            console.error('変換エラー:', error);
        } finally {
            this.isAnimating = false;
        }
    }

    async animateHexToBinaryConversion(hex) {
        const breakdownDiv = document.getElementById('hexDigitBreakdown');
        const stepsDiv = document.getElementById('hexToBinarySteps');
        const resultDiv = document.getElementById('hexToBinaryResult');

        // リセット
        breakdownDiv.innerHTML = '';
        stepsDiv.innerHTML = '';
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('show');

        // 各桁の分解表示
        breakdownDiv.innerHTML = '<h4>ステップ1: 各16進数の桁を分解</h4>';
        const digitContainer = document.createElement('div');
        digitContainer.className = 'hex-digits-container';
        
        for (let i = 0; i < hex.length; i++) {
            const digit = document.createElement('div');
            digit.className = 'hex-digit-item';
            digit.innerHTML = `
                <div class="hex-char">${hex[i]}</div>
                <div class="binary-equiv" style="opacity: 0;"></div>
            `;
            digitContainer.appendChild(digit);
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed / 2);
            }
        }
        
        breakdownDiv.appendChild(digitContainer);

        // 各桁を2進数に変換
        stepsDiv.innerHTML = '<h4>ステップ2: 各桁を4桁の2進数に変換</h4>';
        
        let binaryResult = '';
        
        for (let i = 0; i < hex.length; i++) {
            const hexDigit = hex[i];
            const decimal = parseInt(hexDigit, 16);
            const binary = decimal.toString(2).padStart(4, '0');
            
            // 桁をハイライト
            const digitElements = digitContainer.children;
            digitElements[i].classList.add('highlight');
            
            // 変換ステップを表示
            const step = document.createElement('div');
            step.className = 'calculation-step';
            step.innerHTML = `
                <div>${hexDigit} (16進数) = ${decimal} (10進数) = ${binary} (2進数)</div>
            `;
            stepsDiv.appendChild(step);
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed);
            }
            
            step.classList.add('active');
            
            // 2進数を表示
            const binaryElement = digitElements[i].querySelector('.binary-equiv');
            binaryElement.textContent = binary;
            binaryElement.style.opacity = '1';
            
            binaryResult += binary;
            
            // ハイライト解除
            digitElements[i].classList.remove('highlight');
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed / 2);
            }
        }

        // 最終結果
        resultDiv.innerHTML = `
            <div>変換結果: ${hex} (16進数) = ${binaryResult} (2進数)</div>
        `;
        resultDiv.classList.add('show');
    }

    async convertDecimalToHex() {
        const input = parseInt(document.getElementById('decimalToHexInput').value);
        if (isNaN(input) || input < 0 || input > 65535) {
            alert('0から65535の範囲で10進数を入力してください');
            return;
        }

        this.isAnimating = true;
        const display = document.getElementById('decimalToHexDisplay');
        display.classList.add('active');
        
        try {
            await this.animateDecimalToHexConversion(input);
        } catch (error) {
            console.error('変換エラー:', error);
        } finally {
            this.isAnimating = false;
        }
    }

    async animateDecimalToHexConversion(decimal) {
        const step1Div = document.getElementById('decimalToBinaryProcess');
        const step2Div = document.getElementById('binaryToHexProcess');
        const resultDiv = document.getElementById('decimalToHexResult');

        // リセット
        step1Div.innerHTML = '';
        step2Div.innerHTML = '';
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('show');

        // ステップ1: 10進数→2進数
        const binary = await this.animateDecimalToBinary(decimal, step1Div);
        
        if (!this.isPaused) {
            await this.sleep(this.animationSpeed);
        }

        // ステップ2: 2進数→16進数
        const hex = await this.animateBinaryToHexSimple(binary, step2Div);

        // 最終結果
        resultDiv.innerHTML = `
            <div>変換結果: ${decimal} (10進数) = ${hex} (16進数)</div>
            <div class="conversion-path">変換経路: ${decimal} → ${binary} → ${hex}</div>
        `;
        resultDiv.classList.add('show');
    }

    async animateDecimalToBinary(decimal, container) {
        container.innerHTML = '<div class="process-title">割り算による2進数変換</div>';
        
        const steps = [];
        let current = decimal;
        
        while (current > 0) {
            const remainder = current % 2;
            const quotient = Math.floor(current / 2);
            steps.push({ dividend: current, quotient, remainder });
            current = quotient;
        }

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepDiv = document.createElement('div');
            stepDiv.className = 'division-step';
            stepDiv.innerHTML = `
                <span class="dividend">${step.dividend}</span>
                <span class="divisor">÷ 2 =</span>
                <span class="quotient">${step.quotient}</span>
                <span>余り</span>
                <span class="remainder">${step.remainder}</span>
            `;
            container.appendChild(stepDiv);
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed);
            }
            
            stepDiv.classList.add('active');
        }

        const binary = steps.map(s => s.remainder).reverse().join('');
        
        const resultDiv = document.createElement('div');
        resultDiv.className = 'binary-construction';
        resultDiv.innerHTML = `
            <div>余りを逆順に並べる: ${binary}</div>
        `;
        container.appendChild(resultDiv);
        
        return binary;
    }

    async animateBinaryToHexSimple(binary, container) {
        container.innerHTML = '<div class="process-title">2進数を4桁ずつグループ化</div>';
        
        const paddedBinary = binary.padStart(Math.ceil(binary.length / 4) * 4, '0');
        const groups = [];
        
        for (let i = 0; i < paddedBinary.length; i += 4) {
            groups.push(paddedBinary.substr(i, 4));
        }

        const groupContainer = document.createElement('div');
        groupContainer.className = 'binary-groups';
        
        let hexResult = '';
        
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const decimal = parseInt(group, 2);
            const hex = decimal.toString(16).toUpperCase();
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'binary-group-simple';
            groupDiv.innerHTML = `
                <div class="binary">${group}</div>
                <div class="arrow">↓</div>
                <div class="hex">${hex}</div>
            `;
            groupContainer.appendChild(groupDiv);
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed);
            }
            
            groupDiv.classList.add('active');
            hexResult += hex;
        }
        
        container.appendChild(groupContainer);
        return hexResult;
    }

    async convertHexToDecimal() {
        const input = document.getElementById('hexToDecimalInput').value.trim().toUpperCase();
        if (!input) {
            alert('16進数を入力してください');
            return;
        }

        if (!/^[0-9A-F]+$/.test(input)) {
            alert('16進数は0-9、A-Fで入力してください');
            return;
        }

        this.isAnimating = true;
        const display = document.getElementById('hexToDecimalDisplay');
        display.classList.add('active');
        
        try {
            await this.animateHexToDecimalConversion(input);
        } catch (error) {
            console.error('変換エラー:', error);
        } finally {
            this.isAnimating = false;
        }
    }

    async animateHexToDecimalConversion(hex) {
        const step1Div = document.getElementById('hexToBinaryProcessDecimal');
        const step2Div = document.getElementById('binaryToDecimalProcess');
        const resultDiv = document.getElementById('hexToDecimalResult');

        // リセット
        step1Div.innerHTML = '';
        step2Div.innerHTML = '';
        resultDiv.innerHTML = '';
        resultDiv.classList.remove('show');

        // ステップ1: 16進数→2進数
        const binary = await this.animateHexToBinarySimple(hex, step1Div);
        
        if (!this.isPaused) {
            await this.sleep(this.animationSpeed);
        }

        // ステップ2: 2進数→10進数
        const decimal = await this.animateBinaryToDecimal(binary, step2Div);

        // 最終結果
        resultDiv.innerHTML = `
            <div>変換結果: ${hex} (16進数) = ${decimal} (10進数)</div>
            <div class="conversion-path">変換経路: ${hex} → ${binary} → ${decimal}</div>
        `;
        resultDiv.classList.add('show');
    }

    async animateHexToBinarySimple(hex, container) {
        container.innerHTML = '<div class="process-title">16進数の各桁を2進数に展開</div>';
        
        const expansionContainer = document.createElement('div');
        expansionContainer.className = 'hex-expansion';
        
        let binaryResult = '';
        
        for (let i = 0; i < hex.length; i++) {
            const hexDigit = hex[i];
            const decimal = parseInt(hexDigit, 16);
            const binary = decimal.toString(2).padStart(4, '0');
            
            const expansionDiv = document.createElement('div');
            expansionDiv.className = 'hex-expansion-item';
            expansionDiv.innerHTML = `
                <div class="hex-digit">${hexDigit}</div>
                <div class="arrow">→</div>
                <div class="binary-digits">${binary}</div>
            `;
            expansionContainer.appendChild(expansionDiv);
            
            if (!this.isPaused) {
                await this.sleep(this.animationSpeed);
            }
            
            expansionDiv.classList.add('active');
            binaryResult += binary;
        }
        
        container.appendChild(expansionContainer);
        
        const resultDiv = document.createElement('div');
        resultDiv.className = 'binary-result';
        resultDiv.innerHTML = `結合: ${binaryResult}`;
        container.appendChild(resultDiv);
        
        return binaryResult;
    }

    async animateBinaryToDecimal(binary, container) {
        container.innerHTML = '<div class="process-title">2進数の位取り計算</div>';
        
        const calculationContainer = document.createElement('div');
        calculationContainer.className = 'position-calculation';
        
        let total = 0;
        const terms = [];
        
        for (let i = 0; i < binary.length; i++) {
            const bit = binary[binary.length - 1 - i];
            const power = i;
            const value = parseInt(bit) * Math.pow(2, power);
            
            if (bit === '1') {
                const termDiv = document.createElement('div');
                termDiv.className = 'calculation-term';
                termDiv.innerHTML = `
                    <span class="bit">${bit}</span> × 
                    <span class="power">2^${power}</span> = 
                    <span class="value">${value}</span>
                `;
                calculationContainer.appendChild(termDiv);
                terms.push(value);
                total += value;
                
                if (!this.isPaused) {
                    await this.sleep(this.animationSpeed / 2);
                }
                
                termDiv.classList.add('active');
            }
        }
        
        container.appendChild(calculationContainer);
        
        if (terms.length > 1) {
            const sumDiv = document.createElement('div');
            sumDiv.className = 'calculation-sum';
            sumDiv.innerHTML = `
                <div>合計: ${terms.join(' + ')} = ${total}</div>
            `;
            container.appendChild(sumDiv);
        }
        
        return total;
    }

    generatePracticeProblPem() {
        const mode = document.getElementById('hexPracticeMode').value;
        const display = document.getElementById('hexProblemDisplay');
        const questionDiv = document.getElementById('hexProblemQuestion');
        const answerInput = document.getElementById('hexUserAnswer');
        const feedback = document.getElementById('hexFeedback');

        let problemType;
        if (mode === 'mixed') {
            const types = ['binary-to-hex', 'hex-to-binary', 'decimal-to-hex', 'hex-to-decimal'];
            problemType = types[Math.floor(Math.random() * types.length)];
        } else {
            problemType = mode;
        }

        let question, answer;

        switch (problemType) {
            case 'binary-to-hex':
                const binary = Math.floor(Math.random() * 256).toString(2).padStart(8, '0');
                answer = parseInt(binary, 2).toString(16).toUpperCase();
                question = `次の2進数を16進数に変換してください: ${binary}`;
                this.currentAnswer = answer;
                this.currentType = 'hex';
                break;

            case 'hex-to-binary':
                const hex = Math.floor(Math.random() * 256).toString(16).toUpperCase();
                answer = parseInt(hex, 16).toString(2).padStart(8, '0');
                question = `次の16進数を2進数に変換してください: ${hex}`;
                this.currentAnswer = answer;
                this.currentType = 'binary';
                break;

            case 'decimal-to-hex':
                const decimal = Math.floor(Math.random() * 256);
                answer = decimal.toString(16).toUpperCase();
                question = `次の10進数を16進数に変換してください: ${decimal}`;
                this.currentAnswer = answer;
                this.currentType = 'hex';
                break;

            case 'hex-to-decimal':
                const hexDecimal = Math.floor(Math.random() * 256).toString(16).toUpperCase();
                answer = parseInt(hexDecimal, 16).toString();
                question = `次の16進数を10進数に変換してください: ${hexDecimal}`;
                this.currentAnswer = answer;
                this.currentType = 'decimal';
                break;
        }

        questionDiv.textContent = question;
        answerInput.value = '';
        feedback.textContent = '';
        feedback.classList.remove('show', 'correct', 'incorrect');
        display.style.display = 'block';
        answerInput.focus();
    }

    checkAnswer() {
        const userAnswer = document.getElementById('hexUserAnswer').value.trim().toUpperCase();
        const feedback = document.getElementById('hexFeedback');
        
        this.practiceStats.total++;
        
        if (userAnswer === this.currentAnswer) {
            this.practiceStats.correct++;
            feedback.textContent = '正解です！';
            feedback.className = 'feedback show correct';
        } else {
            feedback.textContent = `不正解です。正解は ${this.currentAnswer} です。`;
            feedback.className = 'feedback show incorrect';
        }
        
        this.updatePracticeStats();
        
        setTimeout(() => {
            this.generatePracticeProblPem();
        }, 2000);
    }

    updatePracticeStats() {
        document.getElementById('hexCorrectCount').textContent = this.practiceStats.correct;
        document.getElementById('hexTotalCount').textContent = this.practiceStats.total;
        
        const accuracy = this.practiceStats.total > 0 ? 
            Math.round((this.practiceStats.correct / this.practiceStats.total) * 100) : 0;
        document.getElementById('hexAccuracy').textContent = `${accuracy}%`;
    }

    pauseAnimation() {
        this.isPaused = true;
        document.getElementById('pauseAllBtn').style.display = 'none';
        document.getElementById('resumeAllBtn').style.display = 'inline-block';
    }

    resumeAnimation() {
        this.isPaused = false;
        document.getElementById('pauseAllBtn').style.display = 'inline-block';
        document.getElementById('resumeAllBtn').style.display = 'none';
    }

    resetAllAnimations() {
        this.isAnimating = false;
        this.isPaused = false;
        
        // すべての表示エリアをリセット
        const displays = [
            'binaryToHexDisplay', 'hexToBinaryDisplay', 
            'decimalToHexDisplay', 'hexToDecimalDisplay'
        ];
        
        displays.forEach(id => {
            const element = document.getElementById(id);
            element.classList.remove('active');
            const children = element.querySelectorAll('div');
            children.forEach(child => {
                child.innerHTML = '';
                child.classList.remove('show', 'active', 'highlight');
            });
        });

        // ボタン状態をリセット
        document.getElementById('pauseAllBtn').style.display = 'inline-block';
        document.getElementById('resumeAllBtn').style.display = 'none';
    }

    async sleep(ms) {
        return new Promise(resolve => {
            const checkPause = () => {
                if (!this.isPaused) {
                    setTimeout(resolve, ms);
                } else {
                    setTimeout(checkPause, 100);
                }
            };
            checkPause();
        });
    }
}

// ページ読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', function() {
    new HexConverter();
});

// モーダル用のCSS（動的に追加）
const modalStyles = `
.conversion-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 15px;
    padding: 0;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 25px;
    border-bottom: 1px solid #dee2e6;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 15px 15px 0 0;
}

.modal-header h3 {
    margin: 0;
    font-size: 1.3rem;
}

.close-modal {
    background: none;
    border: none;
    font-size: 2rem;
    color: white;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.close-modal:hover {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
}

.modal-body {
    padding: 25px;
}

.conversion-example {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.conversion-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

.conversion-row .label {
    font-weight: bold;
    color: #2c3e50;
}

.conversion-row .value {
    font-family: 'Courier New', monospace;
    font-size: 1.2rem;
    font-weight: bold;
}

.conversion-row .value.hex {
    color: #e91e63;
}

.conversion-row .value.decimal {
    color: #28a745;
}

.conversion-row .value.binary {
    color: #007bff;
}

.binary-groups {
    display: flex;
    justify-content: center;
    gap: 15px;
    flex-wrap: wrap;
    margin: 20px 0;
}

.binary-group-simple {
    text-align: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 10px;
    border: 2px solid #dee2e6;
    transition: all 0.5s ease;
    opacity: 0.3;
}

.binary-group-simple.active {
    opacity: 1;
    background: #e3f2fd;
    border-color: #2196f3;
    transform: scale(1.05);
}

.binary-group-simple .binary {
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    color: #007bff;
    margin-bottom: 10px;
}

.binary-group-simple .arrow {
    font-size: 1.2rem;
    color: #6c757d;
    margin: 5px 0;
}

.binary-group-simple .hex {
    font-family: 'Courier New', monospace;
    font-size: 1.3rem;
    font-weight: bold;
    color: #e91e63;
}

.hex-expansion {
    display: flex;
    justify-content: center;
    gap: 15px;
    flex-wrap: wrap;
    margin: 20px 0;
}

.hex-expansion-item {
    text-align: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 10px;
    border: 2px solid #dee2e6;
    transition: all 0.5s ease;
    opacity: 0.3;
}

.hex-expansion-item.active {
    opacity: 1;
    background: #fce4ec;
    border-color: #e91e63;
    transform: scale(1.05);
}

.hex-expansion-item .hex-digit {
    font-family: 'Courier New', monospace;
    font-size: 1.3rem;
    font-weight: bold;
    color: #e91e63;
    margin-bottom: 10px;
}

.hex-expansion-item .arrow {
    font-size: 1.2rem;
    color: #6c757d;
    margin: 5px 0;
}

.hex-expansion-item .binary-digits {
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    color: #007bff;
}

.position-calculation {
    margin: 20px 0;
}

.calculation-term {
    padding: 10px 15px;
    margin: 5px 0;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #17a2b8;
    font-family: 'Courier New', monospace;
    transition: all 0.5s ease;
    opacity: 0.3;
}

.calculation-term.active {
    opacity: 1;
    background: #e1f5fe;
    transform: translateX(10px);
}

.calculation-term .bit {
    color: #007bff;
    font-weight: bold;
}

.calculation-term .power {
    color: #28a745;
    font-weight: bold;
}

.calculation-term .value {
    color: #e91e63;
    font-weight: bold;
}

.calculation-sum {
    margin-top: 20px;
    padding: 15px;
    background: #d4edda;
    border-radius: 8px;
    border: 2px solid #28a745;
    text-align: center;
    font-weight: bold;
    color: #155724;
}

.binary-result {
    margin-top: 15px;
    padding: 15px;
    background: #e3f2fd;
    border-radius: 8px;
    text-align: center;
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    color: #1976d2;
}

.conversion-path {
    margin-top: 10px;
    font-size: 0.9rem;
    color: #6c757d;
    font-style: italic;
}

.hex-digits-container {
    display: flex;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
    margin: 20px 0;
}

.hex-digit-item {
    text-align: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 10px;
    border: 2px solid #dee2e6;
    transition: all 0.5s ease;
}

.hex-digit-item.highlight {
    background: #ffeb3b;
    border-color: #ff9800;
    transform: scale(1.1);
}

.hex-digit-item .hex-char {
    font-family: 'Courier New', monospace;
    font-size: 1.5rem;
    font-weight: bold;
    color: #e91e63;
    margin-bottom: 15px;
}

.hex-digit-item .binary-equiv {
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    color: #007bff;
    padding: 8px;
    background: #e3f2fd;
    border-radius: 6px;
    transition: opacity 0.5s ease;
}

.process-title {
    font-weight: bold;
    color: #2c3e50;
    margin-bottom: 15px;
    text-align: center;
    font-size: 1.1rem;
}
`;

// スタイルシートを動的に追加
if (!document.querySelector('#hex-modal-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'hex-modal-styles';
    styleSheet.textContent = modalStyles;
    document.head.appendChild(styleSheet);
}