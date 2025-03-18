const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: [true, '会话ID是必需的'],
    unique: true,
    trim: true,
    minlength: [3, '会话ID至少需要3个字符'],
    maxlength: [50, '会话ID不能超过50个字符']
  },
  monsters: [{
    id: {
      type: String,
      required: [true, '怪物ID是必需的'],
      trim: true
    },
    name: {
      type: String,
      required: [true, '怪物名称是必需的'],
      trim: true,
      maxlength: [100, '怪物名称不能超过100个字符']
    },
    currentHp: {
      type: Number,
      required: [true, '当前生命值是必需的'],
      min: [0, '当前生命值不能小于0']
    },
    maxHp: {
      type: Number,
      required: [true, '最大生命值是必需的'],
      min: [1, '最大生命值必须大于0']
    },
    tempHp: {
      type: Number,
      default: 0,
      min: [0, '临时生命值不能小于0']
    },
    conditions: [{
      type: String,
      trim: true,
      enum: {
        values: ['中毒', '麻痹', '昏迷', '恐惧', '魅惑', '目盲', '耳聋', '震慑', '石化', '睡眠', '束缚', '其他'],
        message: '无效的状态效果'
      }
    }],
    initiative: {
      type: Number,
      required: [true, '先攻值是必需的'],
      min: [-100, '先攻值不能小于-100'],
      max: [100, '先攻值不能大于100']
    },
    isAdventurer: {
      type: Boolean,
      default: false
    }
  }],
  monsterOrder: [{
    type: String,
    required: true,
    trim: true
  }],
  battlefield: {
    background: {
      type: String,
      trim: true,
      maxlength: [500, '背景图片URL不能超过500个字符']
    },
    pieces: [{
      id: {
        type: String,
        required: [true, '棋子ID是必需的'],
        trim: true
      },
      name: {
        type: String,
        required: [true, '棋子名称是必需的'],
        trim: true,
        maxlength: [100, '棋子名称不能超过100个字符']
      },
      x: {
        type: Number,
        required: [true, 'X坐标是必需的'],
        min: [0, 'X坐标不能小于0']
      },
      y: {
        type: Number,
        required: [true, 'Y坐标是必需的'],
        min: [0, 'Y坐标不能小于0']
      },
      currentHp: {
        type: Number,
        required: [true, '当前生命值是必需的'],
        min: [0, '当前生命值不能小于0']
      },
      maxHp: {
        type: Number,
        required: [true, '最大生命值是必需的'],
        min: [1, '最大生命值必须大于0']
      }
    }],
    settings: {
      gridSize: {
        type: Number,
        default: 50,
        min: [10, '网格大小不能小于10'],
        max: [200, '网格大小不能大于200']
      },
      showGrid: {
        type: Boolean,
        default: true
      }
    }
  },
  diceHistory: [{
    playerName: {
      type: String,
      required: [true, '玩家名称是必需的'],
      trim: true,
      maxlength: [50, '玩家名称不能超过50个字符']
    },
    rollData: {
      type: Object,
      required: [true, '骰子数据是必需的']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 添加索引
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ 'monsters.id': 1 });
sessionSchema.index({ 'battlefield.pieces.id': 1 });
sessionSchema.index({ lastUpdated: -1 });

// 添加虚拟字段
sessionSchema.virtual('activeMonsters').get(function() {
  return this.monsters.filter(m => m.currentHp > 0);
});

sessionSchema.virtual('totalMonsters').get(function() {
  return this.monsters.length;
});

// 添加方法
sessionSchema.methods.updateMonsterHp = async function(monsterId, newHp) {
  const monster = this.monsters.find(m => m.id === monsterId);
  if (!monster) {
    throw new Error('找不到指定的怪物');
  }
  monster.currentHp = Math.max(0, Math.min(newHp, monster.maxHp));
  this.lastUpdated = new Date();
  return this.save();
};

sessionSchema.methods.addCondition = async function(monsterId, condition) {
  const monster = this.monsters.find(m => m.id === monsterId);
  if (!monster) {
    throw new Error('找不到指定的怪物');
  }
  if (!monster.conditions.includes(condition)) {
    monster.conditions.push(condition);
    this.lastUpdated = new Date();
    return this.save();
  }
  return this;
};

sessionSchema.methods.removeCondition = async function(monsterId, condition) {
  const monster = this.monsters.find(m => m.id === monsterId);
  if (!monster) {
    throw new Error('找不到指定的怪物');
  }
  monster.conditions = monster.conditions.filter(c => c !== condition);
  this.lastUpdated = new Date();
  return this.save();
};

// 添加静态方法
sessionSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({ sessionId });
};

sessionSchema.statics.findActiveSessions = function() {
  return this.find({
    lastUpdated: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
};

module.exports = mongoose.model('Session', sessionSchema); 