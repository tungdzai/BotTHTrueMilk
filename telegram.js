require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Danh sách lưu trữ chatId của người dùng
let userChatIds = [];

// Lắng nghe tin nhắn từ người dùng
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // Kiểm tra nếu chatId chưa có trong danh sách thì thêm vào
    if (!userChatIds.includes(chatId)) {
        userChatIds.push(chatId);
        console.log(`Thêm chatId mới: ${chatId}`);
    }

    // Gửi lời chào hoặc thông báo xác nhận
    bot.sendMessage(chatId, "Chào bạn! ChatId của bạn đã được lưu.");
});

// Hàm gửi tin nhắn đến tất cả người dùng
async function sendTelegramMessage(message) {
    for (const chatId of userChatIds) {
        try {
            await bot.sendMessage(chatId, message);
        } catch (error) {
            if (error.response && error.response.statusCode === 429) {
                const retryAfter = error.response.body.parameters.retry_after;
                console.log(`Gặp lỗi 429 với chatId ${chatId}. Chờ ${retryAfter} giây trước khi gửi lại...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 2000));
                await bot.sendMessage(chatId, message); // Thử lại sau khi chờ
            } else {
                console.error(`Lỗi không xác định với chatId ${chatId}:`, error);
            }
        }
    }
}

module.exports = {
    sendTelegramMessage,
    bot
};
