const express = require('express');
const router = express.Router();
const Session = require('../models/session');

// 验证中间件
const validateSessionId = (req, res, next) => {
  const { sessionId } = req.params;
  if (!sessionId || sessionId.length < 3 || sessionId.length > 50) {
    return res.status(400).json({
      success: false,
      error: '无效的会话ID',
      message: '会话ID长度必须在3-50个字符之间'
    });
  }
  next();
};

const validateMonsterData = (req, res, next) => {
  const { monsters, monsterOrder } = req.body;
  
  if (!Array.isArray(monsters)) {
    return res.status(400).json({
      success: false,
      error: '无效的怪物数据',
      message: '怪物数据必须是数组'
    });
  }

  if (!Array.isArray(monsterOrder)) {
    return res.status(400).json({
      success: false,
      error: '无效的顺序数据',
      message: '顺序数据必须是数组'
    });
  }

  // 验证每个怪物数据
  for (const monster of monsters) {
    if (!monster.id || !monster.name || typeof monster.currentHp !== 'number' || 
        typeof monster.maxHp !== 'number' || typeof monster.initiative !== 'number') {
      return res.status(400).json({
        success: false,
        error: '无效的怪物数据',
        message: '怪物数据缺少必要字段'
      });
    }
  }

  // 验证顺序数组是否包含所有怪物ID
  const monsterIds = monsters.map(m => m.id);
  const invalidOrder = monsterOrder.some(id => !monsterIds.includes(id));
  if (invalidOrder) {
    return res.status(400).json({
      success: false,
      error: '无效的顺序数据',
      message: '顺序数组包含不存在的怪物ID'
    });
  }

  next();
};

const validateBattlefieldData = (req, res, next) => {
  const { battlefield } = req.body;
  
  if (!battlefield || typeof battlefield !== 'object') {
    return res.status(400).json({
      success: false,
      error: '无效的战场数据',
      message: '战场数据必须是对象'
    });
  }

  if (battlefield.pieces && !Array.isArray(battlefield.pieces)) {
    return res.status(400).json({
      success: false,
      error: '无效的棋子数据',
      message: '棋子数据必须是数组'
    });
  }

  // 验证每个棋子数据
  if (battlefield.pieces) {
    for (const piece of battlefield.pieces) {
      if (!piece.id || !piece.name || typeof piece.x !== 'number' || 
          typeof piece.y !== 'number' || typeof piece.currentHp !== 'number' || 
          typeof piece.maxHp !== 'number') {
        return res.status(400).json({
          success: false,
          error: '无效的棋子数据',
          message: '棋子数据缺少必要字段'
        });
      }
    }
  }

  next();
};

// 获取会话数据
router.get('/sessions/:sessionId', validateSessionId, async (req, res) => {
  try {
    const session = await Session.findBySessionId(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '未找到会话',
        message: '指定的会话ID不存在'
      });
    }
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('获取会话数据失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: '获取会话数据时发生错误'
    });
  }
});

// 创建或更新会话
router.post('/sessions/:sessionId', 
  validateSessionId, 
  validateMonsterData,
  async (req, res) => {
    try {
      const session = await Session.findOneAndUpdate(
        { sessionId: req.params.sessionId },
        { 
          $set: { 
            monsters: req.body.monsters,
            monsterOrder: req.body.monsterOrder,
            lastUpdated: Date.now()
          }
        },
        { 
          new: true, 
          upsert: true,
          runValidators: true
        }
      );

      // 获取Socket.IO实例
      const io = req.app.get('io');
      if (io) {
        io.to(req.params.sessionId).emit('session-updated', {
          monsters: session.monsters,
          monsterOrder: session.monsterOrder
        });
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('更新会话数据失败:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: '数据验证错误',
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({
        success: false,
        error: '服务器错误',
        message: '更新会话数据时发生错误'
      });
    }
  }
);

// 更新战场状态
router.post('/sessions/:sessionId/battlefield', 
  validateSessionId, 
  validateBattlefieldData,
  async (req, res) => {
    try {
      const session = await Session.findOneAndUpdate(
        { sessionId: req.params.sessionId },
        { 
          $set: { 
            battlefield: req.body.battlefield,
            lastUpdated: Date.now()
          }
        },
        { 
          new: true,
          runValidators: true
        }
      );

      if (!session) {
        return res.status(404).json({
          success: false,
          error: '未找到会话',
          message: '指定的会话ID不存在'
        });
      }

      // 获取Socket.IO实例
      const io = req.app.get('io');
      if (io) {
        io.to(req.params.sessionId).emit('battlefield-updated', {
          battlefield: session.battlefield
        });
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('更新战场状态失败:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: '数据验证错误',
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({
        success: false,
        error: '服务器错误',
        message: '更新战场状态时发生错误'
      });
    }
  }
);

// 删除会话
router.delete('/sessions/:sessionId', validateSessionId, async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ sessionId: req.params.sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '未找到会话',
        message: '指定的会话ID不存在'
      });
    }

    // 获取Socket.IO实例
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.sessionId).emit('session-deleted');
    }

    res.json({
      success: true,
      message: '会话已删除'
    });
  } catch (error) {
    console.error('删除会话失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: '删除会话时发生错误'
    });
  }
});

module.exports = router; 