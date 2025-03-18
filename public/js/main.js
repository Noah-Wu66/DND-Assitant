// 全局变量
let socket;
let currentSession = null;
let monsters = [];
let monsterOrder = [];
let battlefield = {
    background: '',
    pieces: [],
    settings: {
        gridSize: 50,
        showGrid: true
    }
};

// DOM 元素
const monsterGrid = document.querySelector('.monster-grid');
const setupForm = document.querySelector('.setup-form');
const monsterPrefixInput = document.querySelector('#monster-prefix');
const adventurerPrefixInput = document.querySelector('#adventurer-prefix');
const defaultHpInput = document.querySelector('#default-hp');
const statusSelector = document.querySelector('.status-selector');
const diceDialog = document.querySelector('.dice-dialog');
const battlefieldDialog = document.querySelector('.battlefield-dialog');
const syncStatus = document.querySelector('#sync-status');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket();
    setupEventListeners();
    loadSession();
});

// Socket.IO 初始化
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        updateSyncStatus('connected');
    });
    
    socket.on('disconnect', () => {
        updateSyncStatus('disconnected');
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        updateSyncStatus('error');
    });
    
    // 监听会话更新
    socket.on('sessionUpdate', (data) => {
        if (data.sessionId === currentSession) {
            monsters = data.monsters;
            monsterOrder = data.monsterOrder;
            battlefield = data.battlefield;
            renderMonsters();
            renderBattlefield();
        }
    });
}

// 事件监听器设置
function setupEventListeners() {
    // 添加怪物按钮
    document.querySelector('#add-monster').addEventListener('click', () => {
        const prefix = monsterPrefixInput.value;
        const defaultHp = parseInt(defaultHpInput.value) || 100;
        addMonster(prefix, defaultHp, false);
    });
    
    // 添加冒险者按钮
    document.querySelector('#add-adventurer').addEventListener('click', () => {
        const prefix = adventurerPrefixInput.value;
        const defaultHp = parseInt(defaultHpInput.value) || 100;
        addMonster(prefix, defaultHp, true);
    });
    
    // 重置按钮
    document.querySelector('#reset').addEventListener('click', () => {
        if (confirm('确定要重置所有数据吗？')) {
            resetSession();
        }
    });
    
    // 手动同步按钮
    document.querySelector('#manual-sync').addEventListener('click', () => {
        syncSession();
    });
    
    // 骰子模拟按钮
    document.querySelector('#dice-simulator').addEventListener('click', () => {
        showDiceDialog();
    });
    
    // 战场按钮
    document.querySelector('#battlefield').addEventListener('click', () => {
        showBattlefieldDialog();
    });
}

// 会话管理
function loadSession() {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
        currentSession = sessionId;
        fetchSessionData(sessionId);
    } else {
        createNewSession();
    }
}

async function fetchSessionData(sessionId) {
    try {
        const response = await fetch(`/api/battles/${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            monsters = data.monsters;
            monsterOrder = data.monsterOrder;
            battlefield = data.battlefield;
            renderMonsters();
            renderBattlefield();
        }
    } catch (error) {
        console.error('Error fetching session data:', error);
    }
}

async function createNewSession() {
    try {
        const response = await fetch('/api/battles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                monsters: [],
                monsterOrder: []
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentSession = data.sessionId;
            localStorage.setItem('sessionId', currentSession);
        }
    } catch (error) {
        console.error('Error creating new session:', error);
    }
}

// 怪物管理
function addMonster(prefix, defaultHp, isAdventurer) {
    const id = generateId();
    const name = `${prefix}${monsters.length + 1}`;
    
    const monster = {
        id,
        name,
        currentHp: defaultHp,
        maxHp: defaultHp,
        tempHp: 0,
        conditions: [],
        initiative: 0,
        isAdventurer
    };
    
    monsters.push(monster);
    monsterOrder.push(id);
    
    renderMonsters();
    syncSession();
}

function updateMonsterHp(id, amount) {
    const monster = monsters.find(m => m.id === id);
    if (monster) {
        monster.currentHp = Math.max(0, monster.currentHp + amount);
        renderMonsters();
        syncSession();
    }
}

function updateMonsterInitiative(id, value) {
    const monster = monsters.find(m => m.id === id);
    if (monster) {
        monster.initiative = value;
        renderMonsters();
        syncSession();
    }
}

function toggleMonsterCondition(id, condition) {
    const monster = monsters.find(m => m.id === id);
    if (monster) {
        const index = monster.conditions.indexOf(condition);
        if (index === -1) {
            monster.conditions.push(condition);
        } else {
            monster.conditions.splice(index, 1);
        }
        renderMonsters();
        syncSession();
    }
}

function deleteMonster(id) {
    if (confirm('确定要删除这个单位吗？')) {
        monsters = monsters.filter(m => m.id !== id);
        monsterOrder = monsterOrder.filter(id => id !== id);
        renderMonsters();
        syncSession();
    }
}

// 渲染函数
function renderMonsters() {
    monsterGrid.innerHTML = '';
    
    monsterOrder.forEach(id => {
        const monster = monsters.find(m => m.id === id);
        if (monster) {
            const card = createMonsterCard(monster);
            monsterGrid.appendChild(card);
        }
    });
}

function createMonsterCard(monster) {
    const card = document.createElement('div');
    card.className = 'monster-card';
    
    const hpPercentage = (monster.currentHp / monster.maxHp) * 100;
    
    card.innerHTML = `
        <div class="monster-name" contenteditable="true">${monster.name}</div>
        <div class="hp-bar">
            <div class="hp-fill" style="width: ${hpPercentage}%"></div>
        </div>
        <div class="hp-controls">
            <input type="number" class="hp-input" value="${monster.currentHp}" 
                   onchange="updateMonsterHp('${monster.id}', this.value - ${monster.currentHp})">
            <button onclick="updateMonsterHp('${monster.id}', -1)">-1</button>
            <button onclick="updateMonsterHp('${monster.id}', 1)">+1</button>
        </div>
        <div class="initiative-controls">
            <input type="number" class="initiative-input" value="${monster.initiative}"
                   onchange="updateMonsterInitiative('${monster.id}', this.value)">
        </div>
        <div class="conditions">
            ${monster.conditions.map(condition => `
                <span class="condition" onclick="toggleMonsterCondition('${monster.id}', '${condition}')">
                    ${condition}
                </span>
            `).join('')}
        </div>
        <button onclick="deleteMonster('${monster.id}')">删除</button>
    `;
    
    return card;
}

// 战场管理
function showBattlefieldDialog() {
    battlefieldDialog.style.display = 'block';
    renderBattlefield();
}

function renderBattlefield() {
    const container = document.querySelector('.battlefield-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="battlefield-grid" style="background-image: url('${battlefield.background}')">
            ${battlefield.pieces.map(piece => `
                <div class="battlefield-piece" style="left: ${piece.x}px; top: ${piece.y}px">
                    ${piece.name}
                </div>
            `).join('')}
        </div>
    `;
}

// 骰子模拟
function showDiceDialog() {
    diceDialog.style.display = 'block';
}

function rollDice(diceType, quantity) {
    const results = [];
    for (let i = 0; i < quantity; i++) {
        results.push(Math.floor(Math.random() * diceType) + 1);
    }
    
    const total = results.reduce((a, b) => a + b, 0);
    const rollData = {
        diceType,
        quantity,
        results,
        total
    };
    
    socket.emit('diceRoll', {
        sessionId: currentSession,
        rollData
    });
    
    return rollData;
}

// 同步状态管理
function updateSyncStatus(status) {
    const indicator = syncStatus.querySelector('.sync-indicator');
    indicator.className = 'sync-indicator';
    
    switch (status) {
        case 'connected':
            indicator.classList.add('connected');
            syncStatus.textContent = '已连接';
            break;
        case 'disconnected':
            indicator.classList.add('disconnected');
            syncStatus.textContent = '未连接';
            break;
        case 'error':
            indicator.classList.add('error');
            syncStatus.textContent = '连接错误';
            break;
        case 'connecting':
            indicator.classList.add('connecting');
            syncStatus.textContent = '正在连接...';
            break;
    }
}

function syncSession() {
    if (currentSession) {
        socket.emit('sessionUpdate', {
            sessionId: currentSession,
            monsters,
            monsterOrder,
            battlefield
        });
    }
}

// 工具函数
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function resetSession() {
    monsters = [];
    monsterOrder = [];
    battlefield = {
        background: '',
        pieces: [],
        settings: {
            gridSize: 50,
            showGrid: true
        }
    };
    
    renderMonsters();
    renderBattlefield();
    syncSession();
} 