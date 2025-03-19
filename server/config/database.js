const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 超时时间
      socketTimeoutMS: 45000, // Socket超时
      family: 4, // 使用IPv4
      maxPoolSize: 10, // 连接池大小
      minPoolSize: 2, // 最小连接数
      retryWrites: true, // 启用重试写入
      w: 'majority', // 写入确认级别
      readPreference: 'primary', // 修改为primary以支持索引创建
      autoIndex: true, // 自动创建索引
      autoCreate: true, // 自动创建集合
    });

    console.log(`MongoDB连接成功: ${conn.connection.host}`);

    // 监听数据库连接事件
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB连接断开，尝试重新连接...');
      setTimeout(connectDB, 5000);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB重新连接成功');
    });

  } catch (error) {
    console.error('MongoDB连接失败:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    // 根据错误类型决定是否退出进程
    if (error.name === 'MongoServerSelectionError') {
      console.error('无法连接到MongoDB服务器，请检查服务器状态');
      process.exit(1);
    } else if (error.name === 'MongoParseError') {
      console.error('MongoDB连接字符串格式错误，请检查MONGODB_URI环境变量');
      process.exit(1);
    } else {
      console.error('发生未知错误，5秒后尝试重新连接...');
      setTimeout(connectDB, 5000);
    }
  }
};

module.exports = connectDB; 