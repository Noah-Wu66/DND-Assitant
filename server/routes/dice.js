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

const validateRollData = (req, res, next) => {
  const { playerName, rollData } = req.body;
  
  if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: '无效的玩家名称',
      message: '玩家名称不能为空'
    });
  }

  if (!rollData || typeof rollData !== 'object') {
    return res.status(400).json({
      success: false,
      error: '无效的骰子数据',
      message: '骰子数据必须是对象'
    });
  }

  // 验证骰子数据的基本结构
  if (!rollData.dice || !Array.isArray(rollData.dice) || rollData.dice.length === 0) {
    return res.status(400).json({
      success: false,
      error: '无效的骰子数据',
      message: '骰子数据必须包含有效的骰子数组'
    });
  }

  // 验证每个骰子的格式
  for (const die of rollData.dice) {
    if (!die.type || !die.value || typeof die.value !== 'number') {
      return res.status(400).json({
        success: false,
        error: '无效的骰子数据',
        message: '每个骰子必须包含类型和数值'
      });
    }
  }

  next();
};

// 获取骰子历史记录
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

    // 限制返回的历史记录数量
    const limit = parseInt(req.query.limit) || 20;
    const history = session.diceHistory.slice(-limit);

    res.json({
      success: true,
      data: history,
      total: session.diceHistory.length,
      limit
    });
  } catch (error) {
    console.error('获取骰子历史记录失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: '获取骰子历史记录时发生错误'
    });
  }
});

// 更新骰子状态
router.post('/sessions/:sessionId', 
  validateSessionId, 
  validateRollData,
  async (req, res) => {
    try {
      const session = await Session.findOneAndUpdate(
        { sessionId: req.params.sessionId },
        { 
          $push: { 
            diceHistory: {
              playerName: req.body.playerName.trim(),
              rollData: req.body.rollData,
              timestamp: Date.now()
            }
          },
          lastUpdated: Date.now()
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

      // 获取最新的骰子记录
      const latestRoll = session.diceHistory[session.diceHistory.length - 1];

      // 获取Socket.IO实例
      const io = req.app.get('io');
      if (io) {
        io.to(req.params.sessionId).emit('dice-rolled', latestRoll);
      }

      res.json({
        success: true,
        data: latestRoll
      });
    } catch (error) {
      console.error('更新骰子状态失败:', error);
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
        message: '更新骰子状态时发生错误'
      });
    }
  }
);

// 重置骰子历史记录
router.delete('/sessions/:sessionId', validateSessionId, async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { 
        $set: { 
          diceHistory: [],
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
      io.to(req.params.sessionId).emit('dice-reset');
    }

    res.json({
      success: true,
      message: '骰子历史记录已重置'
    });
  } catch (error) {
    console.error('重置骰子历史记录失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: '重置骰子历史记录时发生错误'
    });
  }
});

// 获取骰子统计信息
router.get('/sessions/:sessionId/stats', validateSessionId, async (req, res) => {
  try {
    const session = await Session.findBySessionId(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '未找到会话',
        message: '指定的会话ID不存在'
      });
    }

    // 计算统计信息
    const stats = {
      totalRolls: session.diceHistory.length,
      players: {},
      diceTypes: {},
      averageRolls: {}
    };

    session.diceHistory.forEach(roll => {
      // 统计玩家掷骰次数
      stats.players[roll.playerName] = (stats.players[roll.playerName] || 0) + 1;

      // 统计骰子类型使用情况
      roll.rollData.dice.forEach(die => {
        stats.diceTypes[die.type] = (stats.diceTypes[die.type] || 0) + 1;
        
        // 计算每种骰子的平均值
        if (!stats.averageRolls[die.type]) {
          stats.averageRolls[die.type] = {
            total: 0,
            count: 0
          };
        }
        stats.averageRolls[die.type].total += die.value;
        stats.averageRolls[die.type].count += 1;
      });
    });

    // 计算每种骰子的平均值
    Object.keys(stats.averageRolls).forEach(type => {
      stats.averageRolls[type] = 
        stats.averageRolls[type].total / stats.averageRolls[type].count;
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取骰子统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: '获取骰子统计信息时发生错误'
    });
  }
});

module.exports = router; 