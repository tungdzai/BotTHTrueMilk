require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.ID_TELEGRAM;
const bot = new TelegramBot(token, {polling: true});

async function sendTelegramMessage(message) {
    try {
        await bot.sendMessage(chatId, message);
    } catch (error) {
        console.error(`Lỗi gửi tin nhắn đến Telegram (chatId: ${chatId}):`, error);
    }
}

module.exports = {
    sendTelegramMessage,
    bot
};
