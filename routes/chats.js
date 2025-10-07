const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

router.post('/', auth, chatController.createChat);
router.get('/', auth, chatController.getChats);
router.get('/:chatId', auth, chatController.getChatById);
router.get('/:chatId/messages', auth, chatController.getChatMessages);
router.post('/:chatId/messages', auth, chatController.sendMessage);

module.exports = router;