const axios = require('axios');
const {sendTelegramMessage} = require('./telegram');
const keep_alive = require('./keep_alive.js');
const {getRandomTime} = require("./handlers");

let previousData = {};

async function numberPrize(requestData, reties = 5) {
    if (reties < 0) {
        return null
    }
    if (reties < 5) {
        await getRandomTime(1000, 5000)
    }
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
        return response.data;

    } catch (error) {
        console.error("Lỗi get phone", error);
    }
}

function checkForChanges(newData, url) {
    const previous = previousData[url];
    if (previous) {
        for (const key in newData) {
            if (newData[key] !== previous[key]) {
                return true;
            }
        }
    }
    return false;
}

async function main() {
    const listData = [
        {
            host: 'quatangtopkid.thmilk.vn',
            referer: 'https://quatangtopkid.thmilk.vn/'
        },
        {
            host: 'quatangyogurt.thmilk.vn',
            referer: 'https://quatangyogurt.thmilk.vn/'
        }
    ];

    for (const data of listData) {
        const result = await numberPrize(data);
        console.log(result);
        if (checkForChanges(result, data.referer)) {
            await sendTelegramMessage(`Quà ${data.referer} tụt rồi:bú thôi ô cháu ${result} !`);
        }
        previousData[data.referer] = result;
    }
}

main()
setInterval(main, 3 * 60 * 1000);