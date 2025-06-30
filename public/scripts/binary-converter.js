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
        
        // 割り算ステップをアニメーション表示
        for (let i = 0; i < steps.length; i++) {
            if (this.isPaused) {
                await this.waitForResume();
            }
            
            const step = steps[i];
            const stepDiv = document.createElement('div');
            stepDiv.className = 'division-step';
            stepDiv.innerHTML = `
                <div class="division-equation">
                    ${step.dividend} ÷ 2 = <span class="division-quotient">${step.quotient}</span> 
                    余り <span class="division-remainder">${step.remainder}</span>
                </div>
            `;
            divisionSteps.appendChild(stepDiv);
            
            await this.sleep(200);
            stepDiv.classList.add('visible');
            await this.sleep(this.animationSpeed);
        }
        
        // 2進数構築アニメーション
        construction.innerHTML = `
            <div class="construction-title">余りを下から上へ読み上げて2進数を構築</div>
            <div class="binary-digits" id="binaryDigits"></div>
        `;
        
        const binaryDigits = document.getElementById('binaryDigits');
        const binaryResult = remainders.reverse().join('');
        
        // 各桁を順次表示
        for (let i = 0; i < binaryResult.length; i++) {
            if (this.isPaused) {
                await this.waitForResume();
            }
            
            const digit = binaryResult[i];
            const digitDiv = document.createElement('div');
            digitDiv.className = 'binary-digit';
            digitDiv.textContent = digit;
            binaryDigits.appendChild(digitDiv);
            
            await this.sleep(200);
            digitDiv.classList.add('visible');
            
            // ハイライト効果
            digitDiv.classList.add('highlighted');
            await this.sleep(this.animationSpeed / 2);
            digitDiv.classList.remove('highlighted');
        }
        
        // 最終結果を表示
        finalBinary.innerHTML = `
            <h3>変換結果</h3>
            <div class="binary-result">${binaryResult}</div>
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