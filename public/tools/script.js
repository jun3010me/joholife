// グローバル変数
let currentTab = 'resolution';
let pixelGrid = [];
let currentProblem = 0;
let currentLevel = 1;
let correctCount = 0;
let totalCount = 0;
let problemsAnswered = new Set(); // 解答済み問題を追跡
let correctProblems = new Set(); // 正解した問題を追跡

// 練習問題データ
const problems = {
    1: [
        {
            question: "8×8ピクセル、24ビットカラーの画像のファイルサイズを計算してください。",
            width: 8,
            height: 8,
            colorDepth: 24,
            answer: 192,
            unit: "bytes",
            hint: "手順：①総ピクセル数を計算（幅×高さ）②1ピクセルのバイト数を計算（24ビット÷8）③総バイト数を計算（①×②）"
        },
        {
            question: "16×16ピクセル、8ビットカラーの画像のファイルサイズを計算してください。",
            width: 16,
            height: 16,
            colorDepth: 8,
            answer: 256,
            unit: "bytes",
            hint: "手順：①16×16で総ピクセル数を求める②8ビット÷8で1ピクセルのバイト数を求める③①×②で総バイト数を計算"
        }
    ],
    2: [
        {
            question: "256×128ピクセル、24ビットカラーの画像のファイルサイズをKB単位で計算してください。",
            width: 256,
            height: 128,
            colorDepth: 24,
            answer: 96,
            unit: "kb",
            hint: "手順：①256×128で総ピクセル数②24÷8で1ピクセルのバイト数③総バイト数を計算④バイトをKBに変換（÷1024）"
        },
        {
            question: "512×256ピクセル、8ビットカラーの画像のファイルサイズをKB単位で計算してください。",
            width: 512,
            height: 256,
            colorDepth: 8,
            answer: 128,
            unit: "kb",
            hint: "手順：①512×256で総ピクセル数②8÷8で1ピクセルのバイト数③総バイト数を計算④バイトをKBに変換（÷1024）"
        }
    ],
    3: [
        {
            question: "512×512ピクセル、24ビットカラーの画像のファイルサイズをKB単位で計算してください。",
            width: 512,
            height: 512,
            colorDepth: 24,
            answer: 768,
            unit: "kb",
            hint: "手順：①512×512で総ピクセル数（512の二乗）②24÷8で1ピクセルのバイト数③総バイト数を計算④÷1024でKBに変換"
        },
        {
            question: "1024×1024ピクセル、8ビットカラーの画像のファイルサイズをMB単位で計算してください。",
            width: 1024,
            height: 1024,
            colorDepth: 8,
            answer: 1,
            unit: "mb",
            hint: "手順：①1024×1024で総ピクセル数②8÷8で1ピクセルのバイト数③総バイト数を計算④÷1024÷1024でMBに変換"
        }
    ],
    4: [
        {
            question: "1024×512ピクセル、24ビットカラーの画像のファイルサイズをMB単位で計算してください。",
            width: 1024,
            height: 512,
            colorDepth: 24,
            answer: 1.5,
            unit: "mb",
            hint: "手順：①1024×512で総ピクセル数②24÷8で1ピクセルのバイト数③総バイト数を計算④÷1024でKB⑤÷1024でMBに変換"
        },
        {
            question: "2048×1024ピクセル、8ビットカラーの画像のファイルサイズをMB単位で計算してください。",
            width: 2048,
            height: 1024,
            colorDepth: 8,
            answer: 2,
            unit: "mb",
            hint: "手順：①2048×1024で総ピクセル数②8÷8で1ピクセルのバイト数③総バイト数を計算④÷1024÷1024でMBに変換"
        }
    ]
};

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupTabNavigation();
    setupCalculator();
    setupPixelDisplay();
    setupColorDepthComparison();
    setupPracticeProblems();
}

// タブナビゲーション
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // アクティブタブを更新
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(targetTab + '-tab').classList.add('active');
            
            currentTab = targetTab;
            
            // タブ切り替え時の初期化処理
            if (targetTab === 'pixel') {
                drawPixelGrid();
            } else if (targetTab === 'color-depth') {
                updateColorDepthComparison();
            }
        });
    });
}

// ファイルサイズ計算機
function setupCalculator() {
    const widthInput = document.getElementById('width-input');
    const heightInput = document.getElementById('height-input');
    const colorDepthInput = document.getElementById('color-depth-input');

    [widthInput, heightInput, colorDepthInput].forEach(input => {
        input.addEventListener('input', updateCalculation);
    });

    updateCalculation();
}

function updateCalculation() {
    const width = parseInt(document.getElementById('width-input').value) || 0;
    const height = parseInt(document.getElementById('height-input').value) || 0;
    const colorDepth = parseInt(document.getElementById('color-depth-input').value) || 0;

    // 計算過程を更新
    const totalPixels = width * height;
    const bytesPerPixel = colorDepth / 8;
    const totalBytes = totalPixels * bytesPerPixel;
    const totalMB = totalBytes / (1024 * 1024);

    // 表示を更新
    document.getElementById('pixel-total').textContent = 
        `${width.toLocaleString()} × ${height.toLocaleString()} = ${totalPixels.toLocaleString()} ピクセル`;
    
    document.getElementById('bytes-per-pixel').textContent = 
        `${colorDepth}ビット ÷ 8 = ${bytesPerPixel} バイト/ピクセル`;
    
    document.getElementById('total-bytes').textContent = 
        `${totalPixels.toLocaleString()} × ${bytesPerPixel} = ${totalBytes.toLocaleString()} バイト`;
    
    document.getElementById('total-mb').textContent = 
        `${totalBytes.toLocaleString()} ÷ 1,048,576 = ${totalMB.toFixed(2)} MB`;
    
    document.getElementById('final-result').textContent = `${totalMB.toFixed(2)} MB`;

    // 比較情報を更新
    updateComparisonInfo(totalMB);
}

function updateComparisonInfo(sizeInMB) {
    const comparisonDiv = document.getElementById('comparison-info');
    let comparisons = [];

    if (sizeInMB <= 1.44) {
        comparisons.push('💾 フロッピーディスク: 収まります');
    } else {
        comparisons.push(`💾 フロッピーディスク: ${Math.ceil(sizeInMB / 1.44)} 枚必要`);
    }

    if (sizeInMB <= 10) {
        comparisons.push('📧 メール添付: 一般的な容量制限内');
    } else {
        comparisons.push('📧 メール添付: 容量制限を超える可能性');
    }

    if (sizeInMB <= 5) {
        comparisons.push('📱 スマートフォン: 標準的なサイズ');
    } else {
        comparisons.push('📱 スマートフォン: 高画質写真サイズ');
    }

    comparisonDiv.innerHTML = comparisons.map(comp => `<p>${comp}</p>`).join('');
}

// ピクセル表示機能
function setupPixelDisplay() {
    const pixelSizeSelect = document.getElementById('pixel-size');
    const pixelZoomSlider = document.getElementById('pixel-zoom');
    const pixelZoomValue = document.getElementById('pixel-zoom-value');
    const canvas = document.getElementById('pixel-canvas');

    pixelSizeSelect.addEventListener('change', function() {
        generatePixelGrid();
        updatePixelInfo();
    });
    
    pixelZoomSlider.addEventListener('input', function() {
        pixelZoomValue.textContent = this.value + 'px';
        drawPixelGrid();
        updatePixelInfo();
    });

    canvas.addEventListener('click', handlePixelClick);

    generatePixelGrid();
    updatePixelInfo();
}

function generatePixelGrid() {
    const size = parseInt(document.getElementById('pixel-size').value);
    pixelGrid = [];
    
    for (let y = 0; y < size; y++) {
        pixelGrid[y] = [];
        for (let x = 0; x < size; x++) {
            pixelGrid[y][x] = {
                r: Math.floor(Math.random() * 256),
                g: Math.floor(Math.random() * 256),
                b: Math.floor(Math.random() * 256)
            };
        }
    }
    
    drawPixelGrid();
}

function drawPixelGrid() {
    const canvas = document.getElementById('pixel-canvas');
    const ctx = canvas.getContext('2d');
    const pixelSize = parseInt(document.getElementById('pixel-zoom').value);
    const gridSize = pixelGrid.length;
    
    // 実際のサイズでキャンバスを設定
    canvas.width = gridSize * pixelSize;
    canvas.height = gridSize * pixelSize;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 全ピクセルを描画
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const pixel = pixelGrid[y][x];
            ctx.fillStyle = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            
            // グリッド線（ピクセルサイズが小さすぎる場合は描画しない）
            if (pixelSize >= 3) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
    }
}

function handlePixelClick(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const pixelSize = parseInt(document.getElementById('pixel-zoom').value);
    
    const x = Math.floor((event.clientX - rect.left) / pixelSize);
    const y = Math.floor((event.clientY - rect.top) / pixelSize);
    
    if (x >= 0 && x < pixelGrid[0].length && y >= 0 && y < pixelGrid.length) {
        const pixel = pixelGrid[y][x];
        const pixelInfo = document.getElementById('selected-pixel-info');
        
        pixelInfo.innerHTML = `
            <strong>位置:</strong> (${x}, ${y})<br>
            <strong>RGB値:</strong><br>
            赤: ${pixel.r} (${pixel.r.toString(16).padStart(2, '0')})<br>
            緑: ${pixel.g} (${pixel.g.toString(16).padStart(2, '0')})<br>
            青: ${pixel.b} (${pixel.b.toString(16).padStart(2, '0')})<br>
            <strong>16進数:</strong> #${pixel.r.toString(16).padStart(2, '0')}${pixel.g.toString(16).padStart(2, '0')}${pixel.b.toString(16).padStart(2, '0')}<br>
            <strong>データサイズ:</strong> 3バイト (24ビット)
        `;
    }
}

function updatePixelInfo() {
    const size = parseInt(document.getElementById('pixel-size').value);
    const pixelSize = parseInt(document.getElementById('pixel-zoom').value);
    const canvasSize = size * pixelSize;
    
    // Canvas表示サイズ情報
    document.getElementById('canvas-size-info').textContent = `Canvas: ${canvasSize}×${canvasSize}px`;
    
    // メモリ使用量計算（24ビットカラーの場合）
    const totalPixels = size * size;
    const bytesPerPixel = 3; // 24ビット = 3バイト
    const totalBytes = totalPixels * bytesPerPixel;
    const totalMB = totalBytes / (1024 * 1024);
    
    let memoryText = '';
    if (totalMB >= 1) {
        memoryText = `メモリ使用量: ${totalMB.toFixed(2)}MB相当`;
    } else if (totalBytes >= 1024) {
        memoryText = `メモリ使用量: ${(totalBytes / 1024).toFixed(1)}KB相当`;
    } else {
        memoryText = `メモリ使用量: ${totalBytes}バイト相当`;
    }
    
    document.getElementById('memory-usage').textContent = memoryText;
}

// 色深度比較機能
function setupColorDepthComparison() {
    const sampleImageSelect = document.getElementById('sample-image');
    sampleImageSelect.addEventListener('change', updateColorDepthComparison);
    updateColorDepthComparison();
}

function updateColorDepthComparison() {
    const sampleType = document.getElementById('sample-image').value;
    const canvases = ['depth-1bit', 'depth-4bit', 'depth-8bit', 'depth-24bit'];
    const sizes = ['size-1bit', 'size-4bit', 'size-8bit', 'size-24bit'];
    const depths = [1, 4, 8, 24];
    
    canvases.forEach((canvasId, index) => {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // サンプル画像を生成
        generateSampleImage(ctx, width, height, sampleType, depths[index]);
        
        // ファイルサイズを計算
        const pixelCount = width * height;
        const bytesPerPixel = depths[index] / 8;
        const totalBytes = pixelCount * bytesPerPixel;
        const totalMB = totalBytes / (1024 * 1024);
        
        document.getElementById(sizes[index]).textContent = totalMB.toFixed(3) + ' MB';
    });
}

function generateSampleImage(ctx, width, height, sampleType, colorDepth) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            let r, g, b;
            
            if (sampleType === 'gradient') {
                r = Math.floor((x / width) * 255);
                g = Math.floor((y / height) * 255);
                b = Math.floor(((x + y) / (width + height)) * 255);
            } else if (sampleType === 'photo') {
                r = 120 + Math.sin(x * 0.1) * 50;
                g = 80 + Math.cos(y * 0.1) * 70;
                b = 60 + Math.sin((x + y) * 0.05) * 60;
            } else { // simple
                r = x < width / 2 ? 255 : 0;
                g = y < height / 2 ? 255 : 0;
                b = (x + y) % 50 < 25 ? 255 : 0;
            }
            
            // 色深度に応じて量子化
            if (colorDepth === 1) {
                const gray = (r + g + b) / 3;
                r = g = b = gray > 128 ? 255 : 0;
            } else if (colorDepth === 4) {
                r = Math.floor(r / 85) * 85;
                g = Math.floor(g / 85) * 85;
                b = Math.floor(b / 85) * 85;
            } else if (colorDepth === 8) {
                r = Math.floor(r / 32) * 32;
                g = Math.floor(g / 32) * 32;
                b = Math.floor(b / 32) * 32;
            }
            
            data[index] = r;
            data[index + 1] = g;
            data[index + 2] = b;
            data[index + 3] = 255; // alpha
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// 練習問題機能
function setupPracticeProblems() {
    const levelButtons = document.querySelectorAll('.level-button');
    const hintButton = document.getElementById('hint-button');
    const checkButton = document.getElementById('check-answer');
    const nextButton = document.getElementById('next-problem');

    levelButtons.forEach(button => {
        button.addEventListener('click', function() {
            levelButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentLevel = parseInt(this.dataset.level);
            currentProblem = 0;
            loadProblem();
        });
    });

    hintButton.addEventListener('click', showHint);
    checkButton.addEventListener('click', checkAnswer);
    nextButton.addEventListener('click', nextProblem);

    // 修了証関連のイベントリスナー
    setupCertificateEvents();

    loadProblem();
}

function loadProblem() {
    const problemData = problems[currentLevel];
    if (!problemData || currentProblem >= problemData.length) {
        currentProblem = 0;
    }

    const problem = problemData[currentProblem];
    const problemDiv = document.getElementById('current-problem');

    problemDiv.querySelector('h3').textContent = `問題 ${currentProblem + 1}`;
    problemDiv.querySelector('p').textContent = problem.question;

    const answerInput = document.getElementById('answer-input');
    const unitSelect = document.getElementById('unit-select');
    const feedback = document.getElementById('feedback');
    const hintPanel = document.getElementById('hint-panel');

    answerInput.value = '';
    unitSelect.value = problem.unit;
    feedback.innerHTML = '';
    feedback.className = 'feedback';
    hintPanel.style.display = 'none';

    updateScoreDisplay();
}

function showHint() {
    const problemData = problems[currentLevel][currentProblem];
    const hintPanel = document.getElementById('hint-panel');
    
    hintPanel.innerHTML = `<strong>ヒント:</strong> ${problemData.hint}`;
    hintPanel.style.display = 'block';
}

function checkAnswer() {
    const answerInput = document.getElementById('answer-input');
    const unitSelect = document.getElementById('unit-select');
    const feedback = document.getElementById('feedback');
    const problemData = problems[currentLevel][currentProblem];

    const userAnswer = parseFloat(answerInput.value);
    const userUnit = unitSelect.value;
    
    const problemId = `${currentLevel}-${currentProblem}`;
    
    // 既に解答済みの問題でない場合のみカウント
    if (!problemsAnswered.has(problemId)) {
        totalCount++;
        problemsAnswered.add(problemId);
    }

    if (isNaN(userAnswer)) {
        feedback.innerHTML = '数値を入力してください。';
        feedback.className = 'feedback incorrect';
        return;
    }

    const isCorrect = Math.abs(userAnswer - problemData.answer) < 0.1 && userUnit === problemData.unit;

    if (isCorrect) {
        if (!correctProblems.has(problemId)) {
            correctCount++;
            correctProblems.add(problemId);
        }
        feedback.innerHTML = '🎉 正解です！';
        feedback.className = 'feedback correct';
    } else {
        feedback.innerHTML = '❌ 不正解です。もう一度計算してみてください。';
        feedback.className = 'feedback incorrect';
        correctProblems.delete(problemId); // 間違えた場合は正解セットから削除
    }

    updateScoreDisplay();
    checkCompletion();
}

function nextProblem() {
    currentProblem++;
    const problemData = problems[currentLevel];
    
    if (currentProblem >= problemData.length) {
        currentProblem = 0;
    }
    
    loadProblem();
}

function updateScoreDisplay() {
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('total-count').textContent = totalCount;
}

// 修了判定と修了証表示
function checkCompletion() {
    const totalProblems = getTotalProblemsCount();
    const completionStatus = document.getElementById('completion-status');
    
    if (correctProblems.size === totalProblems) {
        completionStatus.innerHTML = `
            <div class="completed">
                🎉 すべての問題を正解しました！
                <br>
                <button onclick="showCertificate()">🏆 修了証を表示</button>
            </div>
        `;
        completionStatus.className = 'completion-status completed';
    } else {
        completionStatus.innerHTML = `
            残り ${totalProblems - correctProblems.size} 問の正解で修了証を取得できます
        `;
        completionStatus.className = 'completion-status';
    }
}

function getTotalProblemsCount() {
    let total = 0;
    for (let level in problems) {
        total += problems[level].length;
    }
    return total;
}

// 修了証機能
function setupCertificateEvents() {
    const modal = document.getElementById('certificate-modal');
    const closeButtons = [
        document.getElementById('certificate-close'),
        document.getElementById('close-certificate')
    ];
    const downloadButton = document.getElementById('download-certificate');

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    downloadButton.addEventListener('click', downloadCertificate);
}

function showCertificate() {
    const modal = document.getElementById('certificate-modal');
    modal.style.display = 'block';
    generateCertificate();
}

function generateCertificate() {
    const canvas = document.getElementById('certificate-canvas');
    const ctx = canvas.getContext('2d');
    
    // 背景グラデーション
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 外枠
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    
    // 内側の飾り枠
    ctx.strokeStyle = '#f8f9ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
    
    // タイトル
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('修了証', canvas.width / 2, 120);
    
    // 認定文
    ctx.font = '28px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Certificate of Completion', canvas.width / 2, 170);
    
    // メイン文章
    ctx.font = '24px "Segoe UI", Arial, sans-serif';
    ctx.fillText('上記の者は', canvas.width / 2, 240);
    
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
    ctx.fillText('画像デジタル化・ファイルサイズ学習', canvas.width / 2, 290);
    
    ctx.font = '24px "Segoe UI", Arial, sans-serif';
    ctx.fillText('において、全ての練習問題を正解し', canvas.width / 2, 340);
    ctx.fillText('所定の課程を修了したことを認定します', canvas.width / 2, 380);
    
    // 日付
    const today = new Date();
    const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(dateString, canvas.width / 2, 450);
    
    // 発行者
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('画像デジタル化学習ツール', canvas.width / 2, 520);
    ctx.fillText('高校情報Ⅰ対応', canvas.width / 2, 545);
    
    // 装飾的な要素
    drawDecorations(ctx, canvas.width, canvas.height);
}

function drawDecorations(ctx, width, height) {
    // 左上の装飾
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(100, 100, 30, 0, 2 * Math.PI);
    ctx.fill();
    
    // 右上の装飾
    ctx.beginPath();
    ctx.arc(width - 100, 100, 25, 0, 2 * Math.PI);
    ctx.fill();
    
    // 左下の装飾
    ctx.beginPath();
    ctx.arc(100, height - 100, 25, 0, 2 * Math.PI);
    ctx.fill();
    
    // 右下の装飾
    ctx.beginPath();
    ctx.arc(width - 100, height - 100, 30, 0, 2 * Math.PI);
    ctx.fill();
    
    // 星の装飾
    drawStar(ctx, width / 2 - 200, 200, 15);
    drawStar(ctx, width / 2 + 200, 200, 15);
    drawStar(ctx, width / 2 - 150, 480, 12);
    drawStar(ctx, width / 2 + 150, 480, 12);
}

function drawStar(ctx, x, y, size) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x1 = x + Math.cos(angle) * size;
        const y1 = y + Math.sin(angle) * size;
        
        const angle2 = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
        const x2 = x + Math.cos(angle2) * (size * 0.5);
        const y2 = y + Math.sin(angle2) * (size * 0.5);
        
        if (i === 0) {
            ctx.moveTo(x1, y1);
        } else {
            ctx.lineTo(x1, y1);
        }
        ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
}

function downloadCertificate() {
    const canvas = document.getElementById('certificate-canvas');
    const link = document.createElement('a');
    
    const today = new Date();
    const dateString = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    
    link.download = `画像デジタル化学習_修了証_${dateString}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}