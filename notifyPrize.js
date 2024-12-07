const axios = require('axios');
const { sendTelegramMessage } = require('./telegram');
const keep_alive = require('./keep_alive.js');
let previousData = {};

async function numberPrize(requestData) {
    try {
        const response = await axios.get(`${requestData.referer}home/NumberPrize`, {
            headers: {
                'Host': requestData.host,
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest',
                'sec-ch-ua-mobile': '?1',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'referer': requestData.referer,
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                'priority': 'u=1'
            }
        });
        if (!response.data) {
            console.log("Không nhận được dữ liệu từ API");
            return null;
        }
        try {
            const data = JSON.parse(response.data);
            return {
                "Toltal_Laptop": data.Toltal_Laptop,
                "Toltal_Xedap": data.Toltal_Xedap,
                "Toltal_20k": data.Toltal_20k,
                "Toltal_10k": data.Toltal_10k,
                "Toltal_TaiNghe": data.Toltal_TaiNghe,
                "Toltal_MayQuay": data.Toltal_MayQuay,
                "Toltal_Topup": data.Toltal_Topup
            };
        } catch (error) {
            console.error("Lỗi parsing dữ liệu", error);
            return null;
        }
    } catch (error) {
        console.error("Lỗi get phone", error);
        return null;
    }
}

function checkForChanges(newData, previous) {
    const changes = {};
    for (const key in newData) {
        if (previous[key] !== undefined) {
            const change = previous[key] - newData[key]; // Lấy số trước trừ số sau
            if (change !== 0) {
                changes[key] = change; // Lưu thay đổi (chỉ lưu nếu có sự khác biệt)
            }
        }
    }
    return changes;
}

async function main() {
    const listData = [
        {
            name: 'Top Kid',
            host: 'quatangtopkid.thmilk.vn',
            referer: 'https://quatangtopkid.thmilk.vn/'
        },
        {
            name: 'Yogurt',
            host: 'quatangyogurt.thmilk.vn',
            referer: 'https://quatangyogurt.thmilk.vn/'
        }
    ];

    for (const data of listData) {
        const result = await numberPrize(data);
        console.log(result);

        if (result) {
            const previous = previousData[data.referer] || {};
            const changes = checkForChanges(result, previous);

            if (Object.keys(changes).length > 0) {
                let message = `Quà ${data.name} đã thay đổi:\n`;

                for (const key in changes) {
                    const change = changes[key];
                    if (change > 0) {
                        message += `${key}: giảm ${change} (Trước: ${previous[key]}, Hiện tại: ${result[key]})\n`;
                    } else {
                        message += `${key}: tăng ${Math.abs(change)} (Trước: ${previous[key]}, Hiện tại: ${result[key]})\n`;
                    }
                }

                if (message.trim() !== `Quà ${data.name} đã thay đổi:\n`) {
                    await sendTelegramMessage(message);
                }
            }

            previousData[data.referer] = result; // Cập nhật dữ liệu cũ
        }
    }
}

main();
setInterval(main, 60 * 1000);
