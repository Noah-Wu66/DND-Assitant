const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
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

const validateSettings = (req, res, next) => {
  const { settings } = req.body;
  
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({
      success: false,
      error: '无效的设置数据',
      message: '设置数据必须是对象'
    });
  }

  if (typeof settings.gridSize !== 'number' || settings.gridSize < 10 || settings.gridSize > 200) {
    return res.status(400).json({
      success: false,
      error: '无效的网格大小',
      message: '网格大小必须在10-200之间'
    });
  }

  if (typeof settings.showGrid !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: '无效的网格显示设置',
      message: '网格显示设置必须是布尔值'
    });
  }

  next();
};

const validatePieces = (req, res, next) => {
  const { pieces } = req.body;
  
  if (!Array.isArray(pieces)) {
    return res.status(400).json({
      success: false,
      error: '无效的棋子数据',
      message: '棋子数据必须是数组'
    });
  }

  for (const piece of pieces) {
    if (!piece.id || !piece.name || typeof piece.x !== 'number' || 
        typeof piece.y !== 'number' || typeof piece.currentHp !== 'number' || 
        typeof piece.maxHp !== 'number') {
      return res.status(400).json({
        success: false,
        error: '无效的棋子数据',
        message: '棋子数据缺少必要字段'
      });
    }

    if (piece.currentHp < 0 || piece.currentHp > piece.maxHp) {
      return res.status(400).json({
        success: false,
        error: '无效的生命值',
        message: '当前生命值必须在0到最大生命值之间'
      });
    }
  }

  next();
};

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  },
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('只允许上传图片文件！'), false);
    }
    cb(null, true);
  }
});

// 上传战场背景图
router.post('/sessions/:sessionId/background', 
  validateSessionId,
  upload.single('background'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '没有上传文件',
          message: '请选择要上传的图片文件'
        });
      }

      const session = await Session.findBySessionId(req.params.sessionId);
      if (!session) {
        // 删除已上传的文件
        await fs.unlink(req.file.path);
        return res.status(404).json({
          success: false,
          error: '未找到会话',
          message: '指定的会话ID不存在'
        });
      }

      // 如果存在旧背景图，删除它
      if (session.battlefield.background) {
        const oldImagePath = path.join('public', session.battlefield.background);
        try {
          await fs.unlink(oldImagePath);
        } catch (err) {
          console.error('删除旧背景图失败:', err);
        }
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      session.battlefield.background = imageUrl;
      session.lastUpdated = Date.now();
      await session.save();

      // 获取Socket.IO实例
      const io = req.app.get('io');
      if (io) {
        io.to(req.params.sessionId).emit('background-updated', {
          imageUrl: imageUrl
        });
      }

      res.json({
        success: true,
        data: {
          imageUrl: imageUrl
        }
      });
    } catch (error) {
      console.error('上传背景图失败:', error);
      // 如果上传失败，删除已上传的文件
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error('删除上传失败的文件失败:', err);
        }
      }
      res.status(500).json({
        success: false,
        error: '服务器错误',
        message: '上传背景图时发生错误'
      });
    }
  }
);

// 更新战场设置
router.post('/sessions/:sessionId/settings', 
  validateSessionId,
  validateSettings,
  async (req, res) => {
    try {
      const session = await Session.findOneAndUpdate(
        { sessionId: req.params.sessionId },
        { 
          $set: { 
            'battlefield.settings': req.body.settings,
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
        io.to(req.params.sessionId).emit('battlefield-settings-updated', {
          settings: session.battlefield.settings
        });
      }

      res.json({
        success: true,
        data: session.battlefield.settings
      });
    } catch (error) {
      console.error('更新战场设置失败:', error);
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
        message: '更新战场设置时发生错误'
      });
    }
  }
);

// 更新战场棋子位置
router.post('/sessions/:sessionId/pieces', 
  validateSessionId,
  validatePieces,
  async (req, res) => {
    try {
      const session = await Session.findOneAndUpdate(
        { sessionId: req.params.sessionId },
        { 
          $set: { 
            'battlefield.pieces': req.body.pieces,
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
        io.to(req.params.sessionId).emit('battlefield-pieces-updated', {
          pieces: session.battlefield.pieces
        });
      }

      res.json({
        success: true,
        data: session.battlefield.pieces
      });
    } catch (error) {
      console.error('更新战场棋子位置失败:', error);
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
        message: '更新战场棋子位置时发生错误'
      });
    }
  }
);

// 删除战场背景图
router.delete('/sessions/:sessionId/background', validateSessionId, async (req, res) => {
  try {
    const session = await Session.findBySessionId(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '未找到会话',
        message: '指定的会话ID不存在'
      });
    }

    if (session.battlefield.background) {
      const imagePath = path.join('public', session.battlefield.background);
      try {
        await fs.unlink(imagePath);
      } catch (err) {
        console.error('删除背景图文件失败:', err);
      }
    }

    session.battlefield.background = null;
    session.lastUpdated = Date.now();
    await session.save();

    // 获取Socket.IO实例
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.sessionId).emit('background-deleted');
    }

    res.json({
      success: true,
      message: '背景图已删除'
    });
  } catch (error) {
    console.error('删除背景图失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: '删除背景图时发生错误'
    });
  }
});

module.exports = router; 