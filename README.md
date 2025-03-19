# DND战斗助手与骰子模拟器

这是一个用于D&D（龙与地下城）游戏的战斗助手和骰子模拟器Web应用程序。它提供了以下功能：

- 战斗单位管理（怪物和冒险者）
- 生命值追踪
- 状态效果管理
- 先攻顺序管理
- 骰子模拟器
- 战场地图管理
- 实时同步

## 功能特点

### 战斗单位管理
- 添加怪物和冒险者
- 自定义单位名称前缀
- 设置默认生命值
- 删除单位

### 生命值管理
- 实时生命值显示
- 生命值增减按钮
- 生命值进度条
- 临时生命值支持

### 状态效果
- 添加/移除状态效果
- 状态效果可视化
- 自定义状态效果

### 先攻顺序
- 设置单位先攻值
- 按先攻值排序
- 先攻顺序显示

### 骰子模拟器
- 支持多种骰子类型（d4, d6, d8, d10, d12, d20, d100）
- 多骰子投掷
- 投掷动画效果
- 投掷历史记录

### 战场地图
- 网格系统
- 可拖放单位
- 背景图片上传
- 缩放控制
- 网格显示切换

### 实时同步
- 多客户端同步
- 自动保存
- 会话管理
- 连接状态显示

## 安装说明

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/DND-Assistant.git
cd DND-Assistant
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
- 复制 `.env.example` 文件为 `.env`
- 修改 `.env` 文件中的配置：
  ```
  PORT=3000
  MONGODB_URI=your_mongodb_uri
  CORS_ORIGIN=*
  ```

4. 启动服务器：
```bash
npm start
```

5. 访问应用：
打开浏览器访问 `http://localhost:3000`

## 使用说明

### 添加单位
1. 在设置表单中输入单位名称前缀和默认生命值
2. 点击"添加怪物"或"添加冒险者"按钮
3. 单位将显示在网格中

### 管理生命值
1. 使用生命值输入框直接输入数值
2. 使用"+"和"-"按钮增减生命值
3. 生命值进度条会实时更新

### 使用骰子模拟器
1. 点击"骰子模拟器"按钮打开对话框
2. 选择骰子类型和数量
3. 点击"投掷"按钮
4. 查看投掷结果和历史记录

### 使用战场地图
1. 点击"战场"按钮打开战场视图
2. 上传背景图片（可选）
3. 拖放单位到地图上
4. 使用缩放按钮调整视图
5. 使用网格切换按钮显示/隐藏网格

## 技术栈

- 前端：
  - HTML5
  - CSS3
  - JavaScript (ES6+)
  - Socket.IO 客户端

- 后端：
  - Node.js
  - Express
  - Socket.IO
  - MongoDB
  - Mongoose

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

- 项目维护者：[Your Name]
- 邮箱：[your.email@example.com]
- 项目链接：[https://github.com/yourusername/DND-Assistant](https://github.com/yourusername/DND-Assistant) 