// Binary Converter JavaScript
class BinaryConverter {
    constructor() {
        this.animationSpeed = 1500;
        this.isAnimating = false;
        this.isPaused = false;
        this.currentTimeout = null;
        this.animationQueue = [];
        this.practiceScore = {
            correct: 0,
            total: 0
        };
        this.currentProblem = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateSpeedDisplay();
        this.setupExamples();
    }
    
    bindEvents() {
        // 2進数→10進数変換
        document.getElementById('convertBinaryBtn').addEventListener('click', () => {
            this.convertBinaryToDecimal();
        });
        
        // 10進数→2進数変換
        document.getElementById('convertDecimalBtn').addEventListener('click', () => {
            this.convertDecimalToBinary();
        });
        
        // アニメーション制御
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.pauseAnimation();
        });
        
        document.getElementById('resumeBtn').addEventListener('click', () => {
            this.resumeAnimation();
        });
        
        document.getElementById('resetAnimationBtn').addEventListener('click', () => {
            this.resetAnimation();
        });
        
        // 速度制御
        document.getElementById('animationSpeed').addEventListener('input', (e) => {
            this.animationSpeed = parseInt(e.target.value);
            this.updateSpeedDisplay();
        });
        
        // 練習問題
        document.getElementById('generateProblemBtn').addEventListener('click', () => {
            this.generateProblem();
        });
        
        document.getElementById('checkAnswerBtn').addEventListener('click', () => {
            this.checkAnswer();
        });
        
        // Enter キーで答え合わせ
        document.getElementById('userAnswer').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkAnswer();
            }
        });
        
        // 入力値の検証
        document.getElementById('binaryInput').addEventListener('input', (e) => {
            const value = e.target.value;
            const isValid = /^[01]*$/.test(value);
            if (!isValid && value !== '') {
                e.target.setCustomValidity('2進数は0と1のみ入力してください');
            } else if (value.length > 8) {
                e.target.setCustomValidity('8桁以内で入力してください');
            } else {
                e.target.setCustomValidity('');
            }
        });
        
        document.getElementById('decimalInput').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value < 0 || value > 255) {
                e.target.setCustomValidity('0-255の範囲で入力してください');
            } else {
                e.target.setCustomValidity('');
            }
        });
    }
    
    updateSpeedDisplay() {
        const speedDisplay = document.getElementById('speedDisplay');
        speedDisplay.textContent = `${(this.animationSpeed / 1000).toFixed(1)}秒`;
    }
    
    // 2進数→10進数変換
    async convertBinaryToDecimal() {
        const binaryInput = document.getElementById('binaryInput');
        const binaryValue = binaryInput.value.trim();
        
        if (!binaryValue) {
            alert('2進数を入力してください');
            return;
        }
        
        if (!/^[01]+$/.test(binaryValue)) {
            alert('2進数は0と1のみで入力してください');
            return;
        }
        
        if (binaryValue.length > 8) {
            alert('8桁以内で入力してください');
            return;
        }
        
        this.resetAnimation();
        this.isAnimating = true;
        
        try {
            await this.animateBinaryToDecimal(binaryValue);
        } catch (error) {
            console.error('Animation error:', error);
        } finally {
            this.isAnimating = false;
        }
    }
    
    async animateBinaryToDecimal(binaryValue) {
        const display = document.getElementById('binaryToDecimalDisplay');
        const breakdown = document.getElementById('binaryBreakdown');
        const steps = document.getElementById('calculationSteps');
        const result = document.getElementById('finalResult');
        
        // 表示をクリア
        breakdown.innerHTML = '';
        steps.innerHTML = '';
        result.innerHTML = '';
        result.classList.remove('visible');
        
        // 2進数を右から左へパディング（8桁）
        const paddedBinary = binaryValue.padStart(8, '0');
        
        // ビット分解表示を作成
        for (let i = 0; i < paddedBinary.length; i++) {
            const bit = paddedBinary[i];
            const position = paddedBinary.length - 1 - i;
            const weight = Math.pow(2, position);
            
            const bitCell = document.createElement('div');
            bitCell.className = 'bit-cell';
            bitCell.innerHTML = `
                <div class="bit-value">${bit}</div>
                <div class="bit-position">2^${position}</div>
                <div class="bit-weight">${weight}</div>
            `;
            breakdown.appendChild(bitCell);
        }
        
        // ビットを順次アクティブ化
        let totalSum = 0;
        const stepEquations = [];
        
        for (let i = 0; i < paddedBinary.length; i++) {
            if (this.isPaused) {
                await this.waitForResume();
            }
            
            const bit = paddedBinary[i];
            const position = paddedBinary.length - 1 - i;
            const weight = Math.pow(2, position);
            const bitValue = parseInt(bit) * weight;
            
            // ビットをハイライト
            const bitCell = breakdown.children[i];
            bitCell.classList.add('active');
            
            await this.sleep(this.animationSpeed / 2);
            
            // ビットが1の場合のみ計算ステップを表示
            if (bit === '1') {
                bitCell.classList.add('highlighted');
                
                const stepDiv = document.createElement('div');
                stepDiv.className = 'calculation-step';
                stepDiv.innerHTML = `
                    <span class="step-bit">${bit}</span>
                    <span class="step-operator">×</span>
                    <span class="step-weight">${weight}</span>
                    <span class="step-operator">=</span>
                    <span class="step-result">${bitValue}</span>
                `;
                steps.appendChild(stepDiv);
                
                // アニメーション表示
                await this.sleep(100);
                stepDiv.classList.add('visible');
                
                totalSum += bitValue;
                stepEquations.push(`${bit} × ${weight} = ${bitValue}`);
                
                await this.sleep(this.animationSpeed);
                
                bitCell.classList.remove('highlighted');
            } else {
                await this.sleep(this.animationSpeed / 2);
            }
        }
        
        // 最終結果を表示
        const equationText = stepEquations.join(' + ');
        result.innerHTML = `
            <h3>計算結果</h3>
            <div class="result-equation">${equationText}</div>
            <div class="result-value">${totalSum}</div>
        `;
        
        await this.sleep(300);
        result.classList.add('visible');
    }
    
    // 10進数→2進数変換
    async convertDecimalToBinary() {
        const decimalInput = document.getElementById('decimalInput');
        const decimalValue = parseInt(decimalInput.value);
        
        if (isNaN(decimalValue)) {
            alert('10進数を入力してください');
            return;
        }
        
        if (decimalValue < 0 || decimalValue > 255) {
            alert('0-255の範囲で入力してください');
            return;
        }
        
        this.resetAnimation();
        this.isAnimating = true;
        
        try {
            await this.animateDecimalToBinary(decimalValue);
        } catch (error) {
            console.error('Animation error:', error);
        } finally {
            this.isAnimating = false;
        }
    }
    
    async animateDecimalToBinary(decimalValue) {
        const display = document.getElementById('decimalToBinaryDisplay');
        const divisionSteps = document.getElementById('divisionSteps');
        const construction = document.getElementById('binaryConstruction');
        const finalBinary = document.getElementById('finalBinary');
        
        // 表示をクリア
        divisionSteps.innerHTML = '';
        construction.innerHTML = '';
        finalBinary.innerHTML = '';
        finalBinary.classList.remove('visible');
        
        // 割り算の過程を計算
        let currentValue = decimalValue;
        const steps = [];
        const remainders = [];
        
        // 0の場合の特別処理
        if (decimalValue === 0) {
            steps.push({
                dividend: 0,
                quotient: 0,
                remainder: 0
            });
            remainders.push(0);
        } else {
            while (currentValue > 0) {
                const quotient = Math.floor(currentValue / 2);
                const remainder = currentValue % 2;
                
                steps.push({
                    dividend: currentValue,
                    quotient: quotient,
                    remainder: remainder
                });
                
                remainders.push(remainder);
                currentValue = quotient;
            }
        }
        
        // 縦の筆算形式でアニメーション表示
        const longDivisionContainer = document.createElement('div');
        longDivisionContainer.className = 'vertical-division-container';
        longDivisionContainer.innerHTML = `
            <div class="vertical-division" id="verticalDivision">
                <div class="division-steps" id="divisionSteps"></div>
                <div class="remainder-collection" id="remainderCollection"></div>
            </div>
        `;
        divisionSteps.appendChild(longDivisionContainer);
        
        const verticalSteps = document.getElementById('divisionSteps');
        const remainderCollection = document.getElementById('remainderCollection');
        
        // 最初のステップを表示（入力数値を適切に配置）
        const firstStep = document.createElement('div');
        firstStep.className = 'division-step first-step';
        firstStep.style.opacity = '0';
        const paddedValue = decimalValue.toString().padStart(3, ' ');
        firstStep.innerHTML = `
            <span class="division-number">2 ) ${paddedValue}</span>
            <span class="remainder-placeholder"></span>
        `;
        verticalSteps.appendChild(firstStep);
        
        await this.sleep(200);
        firstStep.style.opacity = '1';
        await this.sleep(this.animationSpeed);
        
        // 各割り算ステップを縦に追加
        for (let i = 0; i < steps.length; i++) {
            if (this.isPaused) {
                await this.waitForResume();
            }
            
            const step = steps[i];
            
            // 割り算の段を追加
            const divisionStep = document.createElement('div');
            divisionStep.className = 'division-step';
            divisionStep.style.opacity = '0';
            divisionStep.style.transform = 'translateY(-10px)';
            
            if (step.quotient === 0) {
                // 最後のステップ（商が0の場合） - 数字を右揃えで配置し余りも表示
                divisionStep.innerHTML = `
                    <span class="division-number final-zero">      ${step.quotient}</span>
                    <span class="remainder-value">${step.remainder}</span>
                `;
                divisionStep.classList.add('final-step');
            } else {
                // 通常のステップ - 数字を右揃えで配置
                const paddedQuotient = step.quotient.toString().padStart(3, ' ');
                divisionStep.innerHTML = `
                    <span class="division-number">2 ) ${paddedQuotient}</span>
                    <span class="remainder-value">${step.remainder}</span>
                `;
            }
            
            verticalSteps.appendChild(divisionStep);
            
            await this.sleep(200);
            divisionStep.style.transition = 'all 0.5s ease-out';
            divisionStep.style.opacity = '1';
            divisionStep.style.transform = 'translateY(0)';
            
            await this.sleep(this.animationSpeed);
        }
        
        // 余りの収集をアニメーション
        await this.sleep(500);
        
        // 余りをハイライト
        const remainderElements = verticalSteps.querySelectorAll('.remainder-value');
        for (let i = 0; i < remainderElements.length; i++) {
            remainderElements[i].classList.add('highlighted');
            await this.sleep(300);
        }
        
        // 余りを下から上に読む説明
        remainderCollection.innerHTML = `
            <div class="remainder-instruction">
                <span class="arrow">↑</span>
                <span class="text">余りを下から上に読む</span>
            </div>
            <div class="binary-result-construction" id="binaryConstruction"></div>
        `;
        
        const binaryConstruction = document.getElementById('binaryConstruction');
        const binaryResult = remainders.reverse().join('');
        
        // 各桁を順次表示（下から上へ）
        for (let i = 0; i < binaryResult.length; i++) {
            const digit = binaryResult[i];
            const digitSpan = document.createElement('span');
            digitSpan.className = 'binary-digit-result';
            digitSpan.textContent = digit;
            digitSpan.style.opacity = '0';
            binaryConstruction.appendChild(digitSpan);
            
            await this.sleep(200);
            digitSpan.style.opacity = '1';
            digitSpan.classList.add('pulse');
            await this.sleep(400);
            digitSpan.classList.remove('pulse');
        }
        
        // 最終結果を表示
        finalBinary.innerHTML = `
            <h3>変換結果</h3>
            <div class="binary-result">${remainders.slice().reverse().join('')}</div>
        `;
        
        await this.sleep(300);
        finalBinary.classList.add('visible');
    }
    
    // アニメーション制御
    pauseAnimation() {
        this.isPaused = true;
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('resumeBtn').style.display = 'inline-flex';
        
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }
    }
    
    resumeAnimation() {
        this.isPaused = false;
        document.getElementById('pauseBtn').style.display = 'inline-flex';
        document.getElementById('resumeBtn').style.display = 'none';
    }
    
    resetAnimation() {
        this.isAnimating = false;
        this.isPaused = false;
        
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }
        
        // UI をリセット
        document.getElementById('pauseBtn').style.display = 'inline-flex';
        document.getElementById('resumeBtn').style.display = 'none';
        
        // 表示をクリア
        document.getElementById('binaryBreakdown').innerHTML = '';
        document.getElementById('calculationSteps').innerHTML = '';
        document.getElementById('finalResult').innerHTML = '';
        document.getElementById('divisionSteps').innerHTML = '';
        document.getElementById('binaryConstruction').innerHTML = '';
        document.getElementById('finalBinary').innerHTML = '';
    }
    
    // 練習問題機能
    generateProblem() {
        const mode = document.getElementById('practiceMode').value;
        const problemDisplay = document.getElementById('problemDisplay');
        const problemQuestion = document.getElementById('problemQuestion');
        const userAnswer = document.getElementById('userAnswer');
        const feedback = document.getElementById('feedback');
        
        // フィードバックをクリア
        feedback.classList.remove('visible', 'correct', 'incorrect');
        feedback.innerHTML = '';
        userAnswer.value = '';
        
        let questionType;
        if (mode === 'mixed') {
            questionType = Math.random() < 0.5 ? 'binary-to-decimal' : 'decimal-to-binary';
        } else {
            questionType = mode;
        }
        
        if (questionType === 'binary-to-decimal') {
            // 2進数→10進数問題
            const decimalValue = Math.floor(Math.random() * 256); // 0-255
            const binaryValue = decimalValue.toString(2);
            
            this.currentProblem = {
                type: 'binary-to-decimal',
                question: binaryValue,
                answer: decimalValue.toString()
            };
            
            problemQuestion.innerHTML = `
                <strong>2進数を10進数に変換してください</strong><br>
                <span style="font-family: 'Fira Code', monospace; font-size: 1.5em; color: var(--binary-color);">${binaryValue}</span>
            `;
        } else {
            // 10進数→2進数問題
            const decimalValue = Math.floor(Math.random() * 256); // 0-255
            const binaryValue = decimalValue.toString(2);
            
            this.currentProblem = {
                type: 'decimal-to-binary',
                question: decimalValue.toString(),
                answer: binaryValue
            };
            
            problemQuestion.innerHTML = `
                <strong>10進数を2進数に変換してください</strong><br>
                <span style="font-size: 1.5em; color: var(--decimal-color);">${decimalValue}</span>
            `;
        }
        
        problemDisplay.style.display = 'block';
        userAnswer.focus();
    }
    
    checkAnswer() {
        if (!this.currentProblem) {
            alert('まず問題を生成してください');
            return;
        }
        
        const userAnswer = document.getElementById('userAnswer').value.trim();
        const feedback = document.getElementById('feedback');
        
        if (!userAnswer) {
            alert('答えを入力してください');
            return;
        }
        
        const isCorrect = userAnswer === this.currentProblem.answer;
        
        // スコアを更新
        this.practiceScore.total++;
        if (isCorrect) {
            this.practiceScore.correct++;
        }
        
        this.updateScoreDisplay();
        
        // フィードバックを表示
        feedback.classList.remove('correct', 'incorrect');
        
        if (isCorrect) {
            feedback.classList.add('correct');
            feedback.innerHTML = `
                <strong>正解！</strong><br>
                ${this.currentProblem.question} = ${this.currentProblem.answer}
            `;
        } else {
            feedback.classList.add('incorrect');
            feedback.innerHTML = `
                <strong>不正解</strong><br>
                正解は: ${this.currentProblem.answer}<br>
                あなたの答え: ${userAnswer}
            `;
        }
        
        feedback.classList.add('visible');
        
        // 次の問題を自動生成
        setTimeout(() => {
            this.generateProblem();
        }, 2000);
    }
    
    updateScoreDisplay() {
        document.getElementById('correctCount').textContent = this.practiceScore.correct;
        document.getElementById('totalCount').textContent = this.practiceScore.total;
        
        const accuracy = this.practiceScore.total > 0 
            ? Math.round((this.practiceScore.correct / this.practiceScore.total) * 100)
            : 0;
        document.getElementById('accuracy').textContent = `${accuracy}%`;
    }
    
    // 変換例の設定
    setupExamples() {
        const examples = document.querySelectorAll('.example-item');
        examples.forEach(example => {
            example.addEventListener('click', () => {
                const decimal = example.dataset.decimal;
                const binary = example.dataset.binary;
                
                // 入力フィールドに値を設定
                document.getElementById('decimalInput').value = decimal;
                document.getElementById('binaryInput').value = binary;
                
                // 視覚的フィードバック
                example.style.transform = 'scale(1.05)';
                example.style.backgroundColor = 'var(--converter-primary)';
                example.style.color = 'white';
                
                setTimeout(() => {
                    example.style.transform = '';
                    example.style.backgroundColor = '';
                    example.style.color = '';
                }, 300);
            });
        });
    }
    
    // ユーティリティ関数
    sleep(ms) {
        return new Promise(resolve => {
            this.currentTimeout = setTimeout(resolve, ms);
        });
    }
    
    async waitForResume() {
        while (this.isPaused) {
            await this.sleep(100);
        }
    }
}

// ダークモード対応（将来の拡張用）
class ThemeManager {
    constructor() {
        this.isDark = false;
        this.init();
    }
    
    init() {
        // システムのダークモード設定を確認
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.isDark = true;
        }
        
        // 保存された設定を確認
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.isDark = savedTheme === 'dark';
        }
        
        this.applyTheme();
        this.setupThemeListener();
    }
    
    applyTheme() {
        if (this.isDark) {
            document.documentElement.classList.add('dark-mode');
        } else {
            document.documentElement.classList.remove('dark-mode');
        }
    }
    
    setupThemeListener() {
        // システムのダークモード変更を監視
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('theme')) {
                    this.isDark = e.matches;
                    this.applyTheme();
                }
            });
        }
    }
    
    toggleTheme() {
        this.isDark = !this.isDark;
        this.applyTheme();
        localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    // メインアプリケーションを初期化
    const app = new BinaryConverter();
    
    // テーママネージャーを初期化
    const themeManager = new ThemeManager();
    
    // グローバルに利用可能にする
    window.binaryConverter = app;
    window.themeManager = themeManager;
    
    // ページ読み込み時のアニメーション
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease-out';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
    
    console.log('Binary Converter initialized successfully');
});