// Color Simulator JavaScript
const redSlider = document.getElementById('redSlider');
const greenSlider = document.getElementById('greenSlider');
const blueSlider = document.getElementById('blueSlider');
const cyanSlider = document.getElementById('cyanSlider');
const magentaSlider = document.getElementById('magentaSlider');
const yellowSlider = document.getElementById('yellowSlider');
const keySlider = document.getElementById('keySlider');
const bitDepthSlider = document.getElementById('bitDepthSlider');
const colorCodeInput = document.getElementById('colorCodeInput');
const applyColorCode = document.getElementById('applyColorCode');
const colorCodeMessage = document.getElementById('colorCodeMessage');
const rgbModeButton = document.getElementById('rgbModeButton');
const cmykModeButton = document.getElementById('cmykModeButton');
const rgbSliders = document.querySelector('.rgb-sliders');
const cmykSliders = document.querySelector('.cmyk-sliders');

const redValue = document.getElementById('redValue');
const greenValue = document.getElementById('greenValue');
const blueValue = document.getElementById('blueValue');
const cyanValue = document.getElementById('cyanValue');
const magentaValue = document.getElementById('magentaValue');
const yellowValue = document.getElementById('yellowValue');
const keyValue = document.getElementById('keyValue');
const bitDepthValue = document.getElementById('bitDepthValue');

const colorPreview = document.getElementById('colorPreview');
const hexValue = document.getElementById('hexValue');
const rgbValue = document.getElementById('rgbValue');
const binaryR = document.getElementById('binaryR');
const binaryG = document.getElementById('binaryG');
const binaryB = document.getElementById('binaryB');
const colorCount = document.getElementById('colorCount');
const levelCount = document.getElementById('levelCount');
const totalBits = document.getElementById('totalBits');
const gradationBar = document.getElementById('gradationBar');
const gradationInfo = document.getElementById('gradationInfo');

let currentMode = 'rgb';

// RGB <-> CMYK 変換関数
function rgbToCmyk(r, g, b) {
    r = r / 255;
    g = g / 255;
    b = b / 255;
    
    const k = 1 - Math.max(r, Math.max(g, b));
    const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
    const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
    const y = k === 1 ? 0 : (1 - b - k) / (1 - k);
    
    return {
        c: Math.round(c * 100),
        m: Math.round(m * 100),
        y: Math.round(y * 100),
        k: Math.round(k * 100)
    };
}

function cmykToRgb(c, m, y, k) {
    c = c / 100;
    m = m / 100;
    y = y / 100;
    k = k / 100;
    
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    
    return {
        r: Math.round(r),
        g: Math.round(g),
        b: Math.round(b)
    };
}

function switchMode(mode) {
    currentMode = mode;
    
    if (mode === 'rgb') {
        rgbModeButton.classList.add('active');
        cmykModeButton.classList.remove('active');
        rgbSliders.style.display = 'block';
        cmykSliders.style.display = 'none';
    } else {
        cmykModeButton.classList.add('active');
        rgbModeButton.classList.remove('active');
        rgbSliders.style.display = 'none';
        cmykSliders.style.display = 'block';
        
        // RGBからCMYKに変換
        const cmyk = rgbToCmyk(
            parseInt(redSlider.value),
            parseInt(greenSlider.value),
            parseInt(blueSlider.value)
        );
        
        cyanSlider.value = cmyk.c;
        magentaSlider.value = cmyk.m;
        yellowSlider.value = cmyk.y;
        keySlider.value = cmyk.k;
    }
    
    updateColor();
}

function getDiscreteValues(bitDepth) {
    const levels = Math.pow(2, bitDepth);
    const values = [];
    for (let i = 0; i < levels; i++) {
        values.push(Math.round((i / (levels - 1)) * 255));
    }
    return values;
}

function quantizeValue(value, bitDepth) {
    const discreteValues = getDiscreteValues(bitDepth);
    let closest = discreteValues[0];
    let minDistance = Math.abs(value - closest);
    
    for (let i = 1; i < discreteValues.length; i++) {
        const distance = Math.abs(value - discreteValues[i]);
        if (distance < minDistance) {
            minDistance = distance;
            closest = discreteValues[i];
        }
    }
    return closest;
}

function updateSliderStep() {
    const bitDepth = parseInt(bitDepthSlider.value);
    
    // スライダーのstepを1に設定（連続的な動きを許可）
    redSlider.step = 1;
    greenSlider.step = 1;
    blueSlider.step = 1;
    
    // 現在の値を量子化
    redSlider.value = quantizeValue(parseInt(redSlider.value), bitDepth);
    greenSlider.value = quantizeValue(parseInt(greenSlider.value), bitDepth);
    blueSlider.value = quantizeValue(parseInt(blueSlider.value), bitDepth);
}

function updateColor() {
    const bitDepth = parseInt(bitDepthSlider.value);
    let r, g, b;
    
    if (currentMode === 'rgb') {
        r = quantizeValue(parseInt(redSlider.value), bitDepth);
        g = quantizeValue(parseInt(greenSlider.value), bitDepth);
        b = quantizeValue(parseInt(blueSlider.value), bitDepth);
        
        // スライダーの値を量子化された値に設定
        redSlider.value = r;
        greenSlider.value = g;
        blueSlider.value = b;
        
        // 表示を更新
        redValue.textContent = Math.round(r);
        greenValue.textContent = Math.round(g);
        blueValue.textContent = Math.round(b);
    } else {
        // CMYKモードの場合、CMYKからRGBに変換
        const c = parseInt(cyanSlider.value);
        const m = parseInt(magentaSlider.value);
        const y = parseInt(yellowSlider.value);
        const k = parseInt(keySlider.value);
        
        const rgb = cmykToRgb(c, m, y, k);
        r = quantizeValue(rgb.r, bitDepth);
        g = quantizeValue(rgb.g, bitDepth);
        b = quantizeValue(rgb.b, bitDepth);
        
        // CMYK値の表示を更新
        cyanValue.textContent = c + '%';
        magentaValue.textContent = m + '%';
        yellowValue.textContent = y + '%';
        keyValue.textContent = k + '%';
    }
    
    bitDepthValue.textContent = bitDepth;
    
    // 色プレビューを更新
    const color = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    colorPreview.style.backgroundColor = color;
    
    // 16進数表示
    const hex = `#${Math.round(r).toString(16).padStart(2, '0').toUpperCase()}${Math.round(g).toString(16).padStart(2, '0').toUpperCase()}${Math.round(b).toString(16).padStart(2, '0').toUpperCase()}`;
    hexValue.textContent = hex;
    
    // RGB値表示
    rgbValue.textContent = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    
    // 2進数表示（ビット深度に応じた長さ）
    binaryR.textContent = Math.round(r / (255 / (Math.pow(2, bitDepth) - 1))).toString(2).padStart(bitDepth, '0');
    binaryG.textContent = Math.round(g / (255 / (Math.pow(2, bitDepth) - 1))).toString(2).padStart(bitDepth, '0');
    binaryB.textContent = Math.round(b / (255 / (Math.pow(2, bitDepth) - 1))).toString(2).padStart(bitDepth, '0');
    
    // ビット深度情報
    const levels = Math.pow(2, bitDepth);
    const totalColors = Math.pow(levels, 3);
    const totalBitCount = bitDepth * 3;
    levelCount.textContent = `${levels}段階`;
    colorCount.textContent = `${totalColors.toLocaleString()}色`;
    totalBits.textContent = `${totalBitCount}ビット`;
    
    updateGradation();
}

function updateGradation() {
    const bitDepth = parseInt(bitDepthSlider.value);
    const levels = Math.pow(2, bitDepth);
    
    let gradientStops = [];
    
    // 段階的な色の表示を作成する関数
    function createSteppedGradient(colorValues) {
        const stepWidth = 100 / levels;
        
        for (let i = 0; i < levels; i++) {
            const startPercent = i * stepWidth;
            const endPercent = (i + 1) * stepWidth;
            const color = colorValues[i];
            
            // 各段階で同じ色を保持
            if (i === 0) {
                gradientStops.push(`${color} ${startPercent}%`);
            } else {
                gradientStops.push(`${colorValues[i-1]} ${startPercent}%`);
                gradientStops.push(`${color} ${startPercent}%`);
            }
            
            if (i === levels - 1) {
                gradientStops.push(`${color} ${endPercent}%`);
            }
        }
    }
    
    // 現在の色の階調
    let r, g, b;
    
    if (currentMode === 'rgb') {
        r = quantizeValue(parseInt(redSlider.value), bitDepth);
        g = quantizeValue(parseInt(greenSlider.value), bitDepth);
        b = quantizeValue(parseInt(blueSlider.value), bitDepth);
    } else {
        const rgb = cmykToRgb(
            parseInt(cyanSlider.value),
            parseInt(magentaSlider.value),
            parseInt(yellowSlider.value),
            parseInt(keySlider.value)
        );
        r = quantizeValue(rgb.r, bitDepth);
        g = quantizeValue(rgb.g, bitDepth);
        b = quantizeValue(rgb.b, bitDepth);
    }
    
    // 現在の色から黒への段階的な階調を作成
    const colorValues = [];
    const discreteValues = getDiscreteValues(bitDepth);
    
    for (let i = 0; i < levels; i++) {
        const factor = discreteValues[i] / 255;
        const adjR = Math.round(r * factor);
        const adjG = Math.round(g * factor);
        const adjB = Math.round(b * factor);
        colorValues.push(`rgb(${adjR}, ${adjG}, ${adjB})`);
    }
    
    createSteppedGradient(colorValues);
    gradationInfo.textContent = `現在の色の階調を${levels}段階で表示しています`;
    
    gradationBar.style.background = `linear-gradient(to right, ${gradientStops.join(', ')})`;
}

function parseColorCode(colorCode) {
    // 入力を正規化（空白除去、大文字変換）
    let normalized = colorCode.trim().toUpperCase();
    
    // #記号が先頭にない場合は追加
    if (!normalized.startsWith('#')) {
        normalized = '#' + normalized;
    }
    
    // 16進数カラーコードの形式をチェック
    const hexPattern = /^#([0-9A-F]{6})$/;
    const match = normalized.match(hexPattern);
    
    if (!match) {
        return null;
    }
    
    const hex = match[1];
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return { r, g, b };
}

function applyColorCodeToSliders(rgb) {
    const bitDepth = parseInt(bitDepthSlider.value);
    
    // ビット深度に応じて量子化
    const quantizedR = quantizeValue(rgb.r, bitDepth);
    const quantizedG = quantizeValue(rgb.g, bitDepth);
    const quantizedB = quantizeValue(rgb.b, bitDepth);
    
    if (currentMode === 'rgb') {
        // RGBモードの場合、直接RGBスライダーを更新
        redSlider.value = quantizedR;
        greenSlider.value = quantizedG;
        blueSlider.value = quantizedB;
    } else {
        // CMYKモードの場合、RGBからCMYKに変換してスライダーを更新
        const cmyk = rgbToCmyk(quantizedR, quantizedG, quantizedB);
        cyanSlider.value = cmyk.c;
        magentaSlider.value = cmyk.m;
        yellowSlider.value = cmyk.y;
        keySlider.value = cmyk.k;
    }
    
    // 色を更新
    updateColor();
    
    return { r: quantizedR, g: quantizedG, b: quantizedB };
}

function showColorCodeMessage(message, isError = false) {
    colorCodeMessage.textContent = message;
    colorCodeMessage.className = 'color-code-message ' + (isError ? 'error' : 'success');
    
    // 3秒後にメッセージをクリア
    setTimeout(() => {
        colorCodeMessage.textContent = '';
        colorCodeMessage.className = 'color-code-message';
    }, 3000);
}

function handleColorCodeInput() {
    const inputValue = colorCodeInput.value.trim();
    
    if (!inputValue) {
        showColorCodeMessage('カラーコードを入力してください', true);
        return;
    }
    
    const rgb = parseColorCode(inputValue);
    
    if (!rgb) {
        showColorCodeMessage('無効なカラーコード形式です (#FF0000 形式で入力してください)', true);
        return;
    }
    
    const quantized = applyColorCodeToSliders(rgb);
    showColorCodeMessage(`色を適用しました (R:${quantized.r}, G:${quantized.g}, B:${quantized.b})`);
}

// イベントリスナー
redSlider.addEventListener('input', updateColor);
greenSlider.addEventListener('input', updateColor);
blueSlider.addEventListener('input', updateColor);
cyanSlider.addEventListener('input', updateColor);
magentaSlider.addEventListener('input', updateColor);
yellowSlider.addEventListener('input', updateColor);
keySlider.addEventListener('input', updateColor);
bitDepthSlider.addEventListener('input', function() {
    updateSliderStep();
    updateColor();
});
applyColorCode.addEventListener('click', handleColorCodeInput);
colorCodeInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        handleColorCodeInput();
    }
});

// モード切り替えイベントリスナー
rgbModeButton.addEventListener('click', () => switchMode('rgb'));
cmykModeButton.addEventListener('click', () => switchMode('cmyk'));

// 初期化
updateSliderStep();
updateColor();