// Binary Simulator JavaScript
class NumberBaseSimulator {
    constructor() {
        this.currentValue = 0;
        this.bitCount = 8;
        this.animationInterval = null;
        this.animationSpeed = 1000;
        this.isAnimating = false;
        this.signedMode = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateDisplay();
        this.updateBitDisplay();
    }

    initializeElements() {
        this.bitSlider = document.getElementById('bitSlider');
        this.bitValue = document.getElementById('bitValue');
        this.signedModeCheckbox = document.getElementById('signedMode');
        this.valueSlider = document.getElementById('valueSlider');
        this.valueSliderValue = document.getElementById('valueSliderValue');
        this.incrementBtn = document.getElementById('incrementBtn');
        this.decrementBtn = document.getElementById('decrementBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.binaryValue = document.getElementById('binaryValue');
        this.decimalValue = document.getElementById('decimalValue');
        this.complementValue = document.getElementById('complementValue');
        this.complementLabel = document.getElementById('complementLabel');
        this.hexValue = document.getElementById('hexValue');
        this.bitsContainer = document.getElementById('bitsContainer');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.startAnimationBtn = document.getElementById('startAnimationBtn');
        this.stopAnimationBtn = document.getElementById('stopAnimationBtn');
        this.animationUpRadio = document.getElementById('animationUp');
        this.animationDownRadio = document.getElementById('animationDown');
    }

    setupEventListeners() {
        this.bitSlider.addEventListener('input', () => this.updateBitCount());
        this.signedModeCheckbox.addEventListener('change', () => this.toggleSignedMode());
        this.valueSlider.addEventListener('input', () => this.updateValueFromSlider());
        this.incrementBtn.addEventListener('click', () => this.increment());
        this.decrementBtn.addEventListener('click', () => this.decrement());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.speedSlider.addEventListener('input', () => this.updateSpeed());
        this.startAnimationBtn.addEventListener('click', () => this.startAnimation());
        this.stopAnimationBtn.addEventListener('click', () => this.stopAnimation());
    }

    updateBitCount() {
        this.bitCount = parseInt(this.bitSlider.value);
        this.bitValue.textContent = `${this.bitCount} bit${this.bitCount > 1 ? 's' : ''}`;
        this.currentValue = Math.min(this.currentValue, this.getMaxValue());
        this.updateValueSlider();
        this.updateDisplay();
        this.updateBitDisplay();
    }

    updateValueSlider() {
        this.valueSlider.min = this.getMinValue();
        this.valueSlider.max = this.getMaxValue();
        this.valueSlider.value = this.currentValue;
        this.valueSliderValue.textContent = this.currentValue;
    }

    updateValueFromSlider() {
        this.currentValue = parseInt(this.valueSlider.value);
        this.valueSliderValue.textContent = this.currentValue;
        this.updateDisplay();
        this.animateValueChange();
    }

    getMaxValue() {
        if (this.signedMode) {
            return Math.pow(2, this.bitCount - 1) - 1;
        }
        return Math.pow(2, this.bitCount) - 1;
    }

    getMinValue() {
        if (this.signedMode) {
            return -Math.pow(2, this.bitCount - 1);
        }
        return 0;
    }

    toggleSignedMode() {
        this.signedMode = this.signedModeCheckbox.checked;
        this.currentValue = Math.max(this.getMinValue(), Math.min(this.currentValue, this.getMaxValue()));
        this.updateValueSlider();
        this.updateDisplay();
        this.updateDecimalDisplay();
    }

    updateDecimalDisplay() {
        if (this.signedMode) {
            this.complementValue.style.display = 'block';
            this.complementLabel.style.display = 'block';
            const complement = this.currentValue < 0 ? 
                (Math.pow(2, this.bitCount) + this.currentValue) : this.currentValue;
            this.complementValue.textContent = complement.toString();
        } else {
            this.complementValue.style.display = 'none';
            this.complementLabel.style.display = 'none';
        }
    }

    increment() {
        if (this.currentValue < this.getMaxValue()) {
            this.currentValue++;
            this.updateDisplay();
            this.animateValueChange();
        }
    }

    decrement() {
        if (this.currentValue > this.getMinValue()) {
            this.currentValue--;
            this.updateDisplay();
            this.animateValueChange();
        }
    }

    reset() {
        this.currentValue = 0;
        this.updateDisplay();
        this.animateValueChange();
    }

    updateDisplay() {
        let binary, hex;
        const decimal = this.currentValue.toString(10);
        
        if (this.signedMode && this.currentValue < 0) {
            const complement = Math.pow(2, this.bitCount) + this.currentValue;
            binary = complement.toString(2).padStart(this.bitCount, '0');
            hex = '0x' + complement.toString(16).toUpperCase().padStart(Math.ceil(this.bitCount / 4), '0');
        } else {
            binary = this.currentValue.toString(2).padStart(this.bitCount, '0');
            hex = '0x' + this.currentValue.toString(16).toUpperCase().padStart(Math.ceil(this.bitCount / 4), '0');
        }

        this.binaryValue.textContent = binary;
        this.decimalValue.textContent = decimal;
        this.hexValue.textContent = hex;

        this.updateFontSizes();
        this.updateBitDisplay();
        this.updateValueSlider();
        this.updateDecimalDisplay();
    }

    updateFontSizes() {
        const elements = [this.binaryValue, this.decimalValue, this.hexValue];
        elements.forEach(element => {
            element.className = 'number-value';
            if (this.bitCount >= 14) {
                element.className += ' extra-small-font';
            } else if (this.bitCount >= 11) {
                element.className += ' small-font';
            }
        });
    }

    updateBitDisplay() {
        this.bitsContainer.innerHTML = '';
        let binary;
        if (this.signedMode && this.currentValue < 0) {
            const complement = Math.pow(2, this.bitCount) + this.currentValue;
            binary = complement.toString(2).padStart(this.bitCount, '0');
        } else {
            binary = this.currentValue.toString(2).padStart(this.bitCount, '0');
        }
        
        for (let i = 0; i < this.bitCount; i++) {
            const bit = document.createElement('div');
            bit.className = `bit ${binary[i] === '1' ? 'active' : ''}`;
            bit.textContent = binary[i];
            bit.title = `Bit ${this.bitCount - i - 1}`;
            this.bitsContainer.appendChild(bit);
        }
    }

    animateValueChange() {
        [this.binaryValue, this.decimalValue, this.hexValue].forEach(element => {
            element.style.transform = 'scale(1.1)';
            element.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.3)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                element.style.boxShadow = 'none';
            }, 200);
        });
    }

    updateSpeed() {
        this.animationSpeed = parseInt(this.speedSlider.value);
        this.speedValue.textContent = `${(this.animationSpeed / 1000).toFixed(1)}秒`;
        
        if (this.isAnimating) {
            this.stopAnimation();
            this.startAnimation();
        }
    }

    startAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.startAnimationBtn.disabled = true;
        this.stopAnimationBtn.disabled = false;
        
        const isIncreasing = this.animationUpRadio.checked;
        
        this.animationInterval = setInterval(() => {
            if (isIncreasing) {
                if (this.currentValue >= this.getMaxValue()) {
                    this.currentValue = this.getMinValue();
                } else {
                    this.currentValue++;
                }
            } else {
                if (this.currentValue <= this.getMinValue()) {
                    this.currentValue = this.getMaxValue();
                } else {
                    this.currentValue--;
                }
            }
            this.updateDisplay();
            this.animateValueChange();
        }, this.animationSpeed);
    }

    stopAnimation() {
        if (!this.isAnimating) return;
        
        this.isAnimating = false;
        this.startAnimationBtn.disabled = false;
        this.stopAnimationBtn.disabled = true;
        
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NumberBaseSimulator();
});