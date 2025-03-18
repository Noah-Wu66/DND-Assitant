const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 基本的角色路由
router.get('/', async (req, res) => {
    try {
        res.json({ message: "Characters route working" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 