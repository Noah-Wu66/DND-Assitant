// 骰子类型
const DICE_TYPES = [
    { value: 4, label: 'd4' },
    { value: 6, label: 'd6' },
    { value: 8, label: 'd8' },
    { value: 10, label: 'd10' },
    { value: 12, label: 'd12' },
    { value: 20, label: 'd20' },
    { value: 100, label: 'd100' }
];

// 初始化骰子对话框
function initializeDiceDialog() {
    const diceGrid = document.querySelector('.dice-grid');
    if (!diceGrid) return;
    
    // 渲染骰子网格
    diceGrid.innerHTML = DICE_TYPES.map(dice => `
        <div class="dice-card">
            <div class="dice-image">${dice.label}</div>
            <div class="quantity-controls">
                <button onclick="decrementQuantity('${dice.value}')">-</button>
                <input type="number" id="quantity-${dice.value}" value="1" min="1" max="100">
                <button onclick="incrementQuantity('${dice.value}')">+</button>
            </div>
            <button onclick="rollDice(${dice.value}, getQuantity(${dice.value}))">投掷</button>
        </div>
    `).join('');
    
    // 添加关闭按钮事件
    const closeButton = document.querySelector('.close-dice');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            document.querySelector('.dice-dialog').style.display = 'none';
        });
    }
}

// 数量控制
function getQuantity(diceType) {
    const input = document.querySelector(`#quantity-${diceType}`);
    return parseInt(input.value) || 1;
}

function incrementQuantity(diceType) {
    const input = document.querySelector(`#quantity-${diceType}`);
    const currentValue = parseInt(input.value) || 1;
    if (currentValue < 100) {
        input.value = currentValue + 1;
    }
}

function decrementQuantity(diceType) {
    const input = document.querySelector(`#quantity-${diceType}`);
    const currentValue = parseInt(input.value) || 1;
    if (currentValue > 1) {
        input.value = currentValue - 1;
    }
}

// 骰子动画
function animateDiceRoll(diceType, results) {
    const diceElement = document.createElement('div');
    diceElement.className = 'rolling-dice';
    diceElement.textContent = `d${diceType}`;
    
    const container = document.querySelector('.dice-results');
    container.appendChild(diceElement);
    
    let rolls = 0;
    const maxRolls = 10;
    const interval = setInterval(() => {
        rolls++;
        diceElement.textContent = Math.floor(Math.random() * diceType) + 1;
        
        if (rolls >= maxRolls) {
            clearInterval(interval);
            diceElement.textContent = results[0];
            setTimeout(() => {
                diceElement.remove();
            }, 1000);
        }
    }, 50);
}

// 显示骰子结果
function showDiceResults(rollData) {
    const resultsContainer = document.querySelector('.dice-results');
    if (!resultsContainer) return;
    
    const resultElement = document.createElement('div');
    resultElement.className = 'dice-result';
    
    const resultsText = rollData.results.join(' + ');
    resultElement.innerHTML = `
        <div class="result-header">
            <span>d${rollData.diceType} × ${rollData.quantity}</span>
            <span class="close-result" onclick="this.parentElement.parentElement.remove()">×</span>
        </div>
        <div class="result-details">
            <div>${resultsText} = ${rollData.total}</div>
            <div class="result-time">${new Date().toLocaleTimeString()}</div>
        </div>
    `;
    
    resultsContainer.appendChild(resultElement);
    
    // 保持最新的结果在视图中
    resultsContainer.scrollTop = resultsContainer.scrollHeight;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeDiceDialog();
}); 