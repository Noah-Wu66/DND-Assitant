const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  console.error('错误详情:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // 处理MongoDB错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: '数据验证错误',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: '无效的ID格式',
      message: '请检查ID格式是否正确'
    });
  }

  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: '数据冲突',
      message: '该记录已存在'
    });
  }

  // 处理文件上传错误
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: '文件上传错误',
      message: err.message
    });
  }

  // 处理Socket.IO错误
  if (err.name === 'SocketError') {
    return res.status(400).json({
      success: false,
      error: 'WebSocket连接错误',
      message: err.message
    });
  }

  // 处理JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: '无效的认证令牌',
      message: '请重新登录'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: '认证令牌已过期',
      message: '请重新登录'
    });
  }

  // 处理自定义业务错误
  if (err.isBusinessError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.name,
      message: err.message
    });
  }

  // 处理其他错误
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
  });
};

module.exports = errorHandler; 