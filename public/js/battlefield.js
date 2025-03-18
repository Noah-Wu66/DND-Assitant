// 战场状态
let isDragging = false;
let selectedPiece = null;
let dragOffset = { x: 0, y: 0 };

// 初始化战场
function initializeBattlefield() {
    const container = document.querySelector('.battlefield-container');
    if (!container) return;
    
    // 添加网格背景
    container.addEventListener('click', handleGridClick);
    
    // 添加拖放事件
    container.addEventListener('mousedown', handleDragStart);
    container.addEventListener('mousemove', handleDragMove);
    container.addEventListener('mouseup', handleDragEnd);
    
    // 添加缩放控制
    const zoomControls = document.querySelector('.zoom-controls');
    if (zoomControls) {
        zoomControls.addEventListener('click', handleZoom);
    }
    
    // 添加网格显示切换
    const gridToggle = document.querySelector('.grid-toggle');
    if (gridToggle) {
        gridToggle.addEventListener('click', toggleGrid);
    }
}

// 网格点击处理
function handleGridClick(event) {
    const container = document.querySelector('.battlefield-container');
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 获取网格对齐的坐标
    const gridX = Math.floor(x / battlefield.settings.gridSize) * battlefield.settings.gridSize;
    const gridY = Math.floor(y / battlefield.settings.gridSize) * battlefield.settings.gridSize;
    
    // 如果正在拖动物件，将其放置在新位置
    if (selectedPiece) {
        updatePiecePosition(selectedPiece.id, gridX, gridY);
        selectedPiece = null;
        isDragging = false;
    }
}

// 拖放处理
function handleDragStart(event) {
    const piece = event.target.closest('.battlefield-piece');
    if (!piece) return;
    
    isDragging = true;
    selectedPiece = piece;
    
    const rect = piece.getBoundingClientRect();
    dragOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    
    piece.classList.add('dragging');
}

function handleDragMove(event) {
    if (!isDragging || !selectedPiece) return;
    
    const container = document.querySelector('.battlefield-container');
    const rect = container.getBoundingClientRect();
    
    const x = event.clientX - rect.left - dragOffset.x;
    const y = event.clientY - rect.top - dragOffset.y;
    
    selectedPiece.style.left = `${x}px`;
    selectedPiece.style.top = `${y}px`;
}

function handleDragEnd(event) {
    if (!isDragging || !selectedPiece) return;
    
    selectedPiece.classList.remove('dragging');
    
    const container = document.querySelector('.battlefield-container');
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 获取网格对齐的坐标
    const gridX = Math.floor(x / battlefield.settings.gridSize) * battlefield.settings.gridSize;
    const gridY = Math.floor(y / battlefield.settings.gridSize) * battlefield.settings.gridSize;
    
    updatePiecePosition(selectedPiece.id, gridX, gridY);
    selectedPiece = null;
    isDragging = false;
}

// 缩放处理
function handleZoom(event) {
    const button = event.target.closest('button');
    if (!button) return;
    
    const delta = button.classList.contains('zoom-in') ? 5 : -5;
    battlefield.settings.gridSize = Math.max(20, Math.min(100, battlefield.settings.gridSize + delta));
    
    // 更新所有物件的位置以匹配新的网格大小
    battlefield.pieces.forEach(piece => {
        const element = document.querySelector(`[data-piece-id="${piece.id}"]`);
        if (element) {
            const gridX = Math.floor(piece.x / battlefield.settings.gridSize) * battlefield.settings.gridSize;
            const gridY = Math.floor(piece.y / battlefield.settings.gridSize) * battlefield.settings.gridSize;
            element.style.left = `${gridX}px`;
            element.style.top = `${gridY}px`;
        }
    });
    
    renderGrid();
}

// 网格显示切换
function toggleGrid() {
    battlefield.settings.showGrid = !battlefield.settings.showGrid;
    renderGrid();
}

// 渲染网格
function renderGrid() {
    const container = document.querySelector('.battlefield-container');
    if (!container) return;
    
    const gridOverlay = container.querySelector('.grid-overlay');
    if (!gridOverlay) return;
    
    if (battlefield.settings.showGrid) {
        const gridSize = battlefield.settings.gridSize;
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        
        gridOverlay.style.backgroundImage = `
            linear-gradient(to right, #ddd 1px, transparent 1px),
            linear-gradient(to bottom, #ddd 1px, transparent 1px)
        `;
        gridOverlay.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    } else {
        gridOverlay.style.backgroundImage = 'none';
    }
}

// 更新物件位置
function updatePiecePosition(pieceId, x, y) {
    const piece = battlefield.pieces.find(p => p.id === pieceId);
    if (piece) {
        piece.x = x;
        piece.y = y;
        syncSession();
    }
}

// 添加新物件
function addPiece(name, x, y) {
    const piece = {
        id: generateId(),
        name,
        x,
        y
    };
    
    battlefield.pieces.push(piece);
    renderBattlefield();
    syncSession();
}

// 删除物件
function deletePiece(pieceId) {
    battlefield.pieces = battlefield.pieces.filter(p => p.id !== pieceId);
    renderBattlefield();
    syncSession();
}

// 更新背景图片
async function updateBackground(file) {
    const formData = new FormData();
    formData.append('background', file);
    
    try {
        const response = await fetch(`/api/battlefield/${currentSession}/background`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            battlefield.background = data.imageUrl;
            renderBattlefield();
            syncSession();
        }
    } catch (error) {
        console.error('Error uploading background:', error);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeBattlefield();
    renderGrid();
}); 