const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const battlesRoutes = require('./server/routes/battles');
const diceRoutes = require('./server/routes/dice');
const battlefieldRoutes = require('./server/routes/battlefield');
const errorHandler = require('./server/middlewares/errorHandler');
const connectDB = require('./server/config/database');

// 初始化应用
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// 将io实例保存到app中以便在路由中使用
app.set('io', io);

// 连接数据库
connectDB();

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// 提供静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查路由
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'DnD Assistant API',
    version: '1.0.0' 
  });
});

// API路由
app.use('/api/battles', battlesRoutes);
app.use('/api/dice', diceRoutes);
app.use('/api/battlefield', battlefieldRoutes);

// 处理SPA的所有其他请求
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 存储骰子会话历史记录的内存缓存
const diceSessionHistory = {};

// WebSocket中间件 - 连接验证
io.use((socket, next) => {
  const sessionId = socket.handshake.query.sessionId;
  if (!sessionId) {
    return next(new Error('缺少会话ID'));
  }
  socket.sessionId = sessionId;
  next();
});

// WebSocket处理
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'Session:', socket.sessionId);
  let joinedDiceSession = null;
  let playerName = null;
  
  // 验证会话ID
  if (!socket.sessionId) {
    socket.disconnect();
    return;
  }
  
  // 战斗助手相关事件
  socket.on('join-session', (sessionId) => {
    if (sessionId !== socket.sessionId) {
      console.error(`Invalid session ID: ${sessionId}`);
      return;
    }
    console.log(`Client ${socket.id} joined battle session: ${sessionId}`);
    socket.join(sessionId);
  });
  
  socket.on('update-monster', (data) => {
    if (data && data.sessionId === socket.sessionId && data.monster) {
      console.log(`Monster update in ${data.sessionId}: ${data.monster.id}`);
      socket.to(data.sessionId).emit('monster-updated', data.monster);
    }
  });
  
  socket.on('delete-monster', (data) => {
    if (data && data.sessionId === socket.sessionId && data.monsterId) {
      console.log(`Monster deleted in ${data.sessionId}: ${data.monsterId}`);
      socket.to(data.sessionId).emit('delete-monster', {
        monsterId: data.monsterId
      });
    }
  });
  
  socket.on('session-update', (data) => {
    if (data && data.sessionId === socket.sessionId && data.data) {
      console.log(`Session update in ${data.sessionId}`);
      socket.to(data.sessionId).emit('session-updated', data.data);
    }
  });
  
  socket.on('reorder-monsters', (data) => {
    if (data && data.sessionId === socket.sessionId && data.order) {
      console.log(`Monster order update in ${data.sessionId}`);
      
      // 广播顺序更新事件给其他客户端
      socket.to(data.sessionId).emit('monsters-reordered', {
        order: data.order
      });
      
      // 更新数据库中的顺序
      const Session = require('./server/models/session');
      Session.findOneAndUpdate(
        { sessionId: data.sessionId },
        { monsterOrder: data.order, lastUpdated: Date.now() },
        { new: true }
      ).catch(err => console.error('Error updating monster order:', err));
    }
  });
  
  // 骰子模拟器相关事件
  socket.on('join-dice-session', (data) => {
    if (!data || data.sessionId !== socket.sessionId) return;
    
    joinedDiceSession = data.sessionId;
    playerName = data.playerName || "未知玩家";
    
    console.log(`Client ${socket.id} (${playerName}) joined dice session: ${joinedDiceSession}`);
    socket.join(joinedDiceSession);
    
    // 如果存在历史记录，发送给新加入的客户端
    if (diceSessionHistory[joinedDiceSession]) {
      socket.emit('roll-history-sync', diceSessionHistory[joinedDiceSession]);
    }
  });
  
  socket.on('update-dice-state', (data) => {
    if (data && data.sessionId === socket.sessionId && data.diceState) {
      console.log(`Dice state update in ${data.sessionId} by ${data.playerName || 'unknown'}`);
      socket.to(data.sessionId).emit('dice-state-updated', data.diceState);
    }
  });
  
  socket.on('roll-dice', (data) => {
    if (data && data.sessionId === socket.sessionId && data.rollData) {
      console.log(`Dice roll in ${data.sessionId} by ${data.rollData.playerName || 'unknown'}`);
      
      // 存储骰子结果到历史记录
      if (!diceSessionHistory[data.sessionId]) {
        diceSessionHistory[data.sessionId] = [];
      }
      
      // 限制历史记录大小
      if (diceSessionHistory[data.sessionId].length >= 20) {
        diceSessionHistory[data.sessionId].shift(); // 移除最旧的记录
      }
      
      diceSessionHistory[data.sessionId].push(data.rollData);
      
      // 广播骰子结果给其他玩家
      socket.to(data.sessionId).emit('dice-rolled', data.rollData);
    }
  });
  
  socket.on('reset-dice', (data) => {
    if (data && data.sessionId === socket.sessionId) {
      console.log(`Dice reset in ${data.sessionId} by ${data.playerName || 'unknown'}`);
      
      // 清空这个会话的历史记录
      if (diceSessionHistory[data.sessionId]) {
        diceSessionHistory[data.sessionId] = [];
      }
      
      // 广播重置事件给其他客户端
      socket.to(data.sessionId).emit('reset-dice');
    }
  });
  
  // 战场相关事件
  socket.on('join-battlefield', (sessionId) => {
    if (sessionId !== socket.sessionId) {
      console.error(`Invalid session ID: ${sessionId}`);
      return;
    }
    console.log(`Client ${socket.id} joined battlefield session: ${sessionId}`);
    socket.join(sessionId);
  });
  
  socket.on('piece-moved', (data) => {
    if (data && data.sessionId === socket.sessionId && data.pieceId && data.x !== undefined && data.y !== undefined) {
      console.log(`Piece moved in ${data.sessionId}: ${data.pieceId}`);
      socket.to(data.sessionId).emit('piece-moved', {
        pieceId: data.pieceId,
        x: data.x,
        y: data.y
      });
    }
  });
  
  socket.on('background-updated', (data) => {
    if (data && data.sessionId === socket.sessionId && data.imageUrl) {
      console.log(`Background updated in ${data.sessionId}`);
      socket.to(data.sessionId).emit('background-updated', {
        imageUrl: data.imageUrl
      });
    }
  });
  
  socket.on('battlefield-settings-updated', (data) => {
    if (data && data.sessionId === socket.sessionId && data.settings) {
      console.log(`Battlefield settings updated in ${data.sessionId}`);
      socket.to(data.sessionId).emit('battlefield-settings-updated', data.settings);
    }
  });
  
  socket.on('battlefield-state-updated', (data) => {
    if (data && data.sessionId === socket.sessionId && data.state) {
      console.log(`Battlefield state updated in ${data.sessionId}`);
      socket.to(data.sessionId).emit('battlefield-state-updated', {
        state: data.state
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    joinedDiceSession = null;
  });
});

// 错误处理
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 导出应用供测试使用
module.exports = { app, io }; 