require('dotenv').config();
const axios = require('axios');
const {getProxiesData, requests, batchSize} = require('./proxy');
const {generateCardCode, generateRandomPhone, generateRandomUserName, getRandomTime} = require('./handlers');
const {sendTelegramMessage} = require('./telegram');
const fs = require('fs');
const {HttpsProxyAgent} = require('https-proxy-agent');

let cachedProxies = null;
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT || 10000; // 10 giây timeout mặc định
const MAX_RUNTIME = process.env.MAX_RUNTIME || 60000; // 1 phút mặc định

async function getCachedProxies() {
    if (cachedProxies) return cachedProxies;

    const proxiesData = await getProxiesData();
    if (!proxiesData || proxiesData.length === 0) {
        await sendTelegramMessage('⚠️ Không có proxy nào khả dụng để sử dụng.');
        console.error('Không có proxy nào để sử dụng');
        return null;
    }
    console.log(`✅ Số proxy hoạt động: ${proxiesData.length}`);
    cachedProxies = proxiesData;
    return cachedProxies;
}

async function getProxyGroups() {
    const proxiesData = await getCachedProxies();
    if (!proxiesData || proxiesData.length === 0) return [];

    const groupSize = 25; // Mỗi nhóm gồm 25 proxy
    const proxyGroups = [];
    for (let i = 0; i < proxiesData.length; i += groupSize) {
        proxyGroups.push(proxiesData.slice(i, i + groupSize));
    }
    return proxyGroups;
}

async function httpsProxyAgent(proxy) {
    if (!proxy) return null;

    const [proxyHost, proxyPort, proxyUser, proxyPassword] = proxy.split(':');
    if (!proxyHost || !proxyPort) {
        console.error('⚠️ Proxy không đúng định dạng.');
        return null;
    }

    const proxyUrl = proxyUser && proxyPassword
        ? `http://${proxyUser}:${proxyPassword}@${proxyHost}:${proxyPort}`
        : `http://${proxyHost}:${proxyPort}`;
    return new HttpsProxyAgent(proxyUrl);
}

async function withTimeout(promise, timeout) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout exceeded')), timeout))
    ]);
}

async function login(agent) {
    try {
        const randomName = await generateRandomUserName();
        const nameParts = randomName.split(' ');
        const lastName = nameParts[0];
        const middleName = nameParts.slice(1, -1).join(' ');
        const firstName = nameParts[nameParts.length - 1];
        const phone = await generateRandomPhone();
        const data = `name=${lastName}+${middleName}+${firstName}&phone=${phone}`;
        const response = await withTimeout(
            await axios.post('https://thmistoriapi.zalozns.net/backend-user/login/th', data, {
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
                httpAgent: agent,
                httpsAgent: agent
            }),
            REQUEST_TIMEOUT
        );
        return response.data
    } catch (error) {
        console.error('login lỗi:', error.response ? error.response.status : error.message);
        return null
    }
}

async function checkCodeLucky(agent, token, gift) {
    try {

        const response = await withTimeout(
            await axios.get(`https://thmistoriapi.zalozns.net/campaigns/check-code-lucky/${gift}`, {
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
                httpAgent: agent,
                httpsAgent: agent
            }),
            REQUEST_TIMEOUT
        );
        return response.data

    } catch (error) {
        console.error('checkCodeLucky lỗi:', error.response ? error.response.status : error.message);
        return null
    }
}

async function handle(giftCode, agent) {
    if (agent) {
        const result = await login(agent);
        if (result !== null) {
            if (result.result_code === 100) {
                const token = result.token;
                return await checkCodeLucky(agent, token, giftCode);
            }
        }
    }
}

async function sendDataToAPI(code, batchNumber, proxy) {
    try {
        const agent = await httpsProxyAgent(proxy);
        const giftCode = `MY4${code}`
        const response = await handle(giftCode, agent);
        if (response && response.result_code === 100) {
            fs.appendFileSync('mistoris.txt', `${giftCode}\n`, 'utf8');
            console.log(`Đã ghi mã ${giftCode} vào file mistoris.txt`);
        } else {
            if (response){
                if ((response.title !== '<p>Mã quay thưởng <br> không hợp lệ</p>') && (response.title !== '<p>Mã quay thưởng <br> đã sử dụng</p>')) {
                    fs.appendFileSync('mistoris.txt', `${giftCode}\n`, 'utf8');
                    console.log(`Đã ghi mã ${giftCode} vào file mistoris.txt`);
                }
                console.log(`[Batch ${batchNumber}] ${agent.proxy.hostname} ${giftCode}  ${response.title}`);

            }
        }

    } catch (error) {
        console.error('sendDataToAPI lỗi:', error.response ? error.response.status : error.message);
        return null;
    }
}

async function runBatchMis(batchNumber, proxyGroup, signal) {
    const promises = [];
    let proxyIndex = 0; // Bắt đầu từ proxy đầu tiên

    for (let i = 0; i < batchSize; i++) {
        if (signal.aborted) {
            console.warn(`Batch ${batchNumber} bị hủy do quá thời gian.`);
            return;
        }

        const code = await generateCardCode(); // Tạo mã code
        const proxy = proxyGroup[proxyIndex]; // Chọn proxy hiện tại
        proxyIndex = (proxyIndex + 1) % proxyGroup.length; // Chuyển sang proxy tiếp theo (vòng lặp lại nếu hết nhóm proxy)

        // Thêm promise xử lý request
        promises.push(sendDataToAPI(code, batchNumber, proxy));

        // Giãn cách thời gian giữa các request
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    try {
        // Chờ tất cả các request hoàn thành hoặc timeout
        await withTimeout(Promise.allSettled(promises), REQUEST_TIMEOUT * 3);
        console.log(`Batch ${batchNumber} đã hoàn thành`);
    } catch (error) {
        console.error(`Batch ${batchNumber} bị treo quá lâu và đã bị bỏ qua.`);
    }
}


async function independentRequests(requests, signal, proxyGroups) {
    const batchPromises = [];

    for (let i = 0; i < requests; i++) {
        if (signal.aborted) throw new Error('AbortError');
        const proxyGroup = proxyGroups[i]; // Nhóm proxy tương ứng với luồng
        batchPromises.push(runBatchMis(i + 1, proxyGroup, signal));
    }

    await Promise.allSettled(batchPromises);
}

async function checkProxyAndRun() {
    while (true) {
        const controller = new AbortController();
        const signal = controller.signal;

        const timeout = setTimeout(() => {
            console.warn(`Đã hết ${MAX_RUNTIME / 60000} phút, hủy phiên làm việc hiện tại và khởi động lại...`);
            controller.abort();
        }, MAX_RUNTIME);

        try {
            const proxyGroups = await getProxyGroups();
            if (proxyGroups.length === 0) {
                console.error('Không có proxy nào khả dụng.');
                break;
            }

            console.log(`Tìm thấy ${proxyGroups.length} nhóm proxy.`);
            const requests = proxyGroups.length; // Số lượng luồng = số nhóm proxy
            await independentRequests(requests, signal, proxyGroups);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('Phiên làm việc đã bị hủy do vượt quá thời gian cho phép.');
            } else {
                console.error('Lỗi trong checkProxyAndRun:', error.message);
            }
        } finally {
            clearTimeout(timeout);
            cachedProxies = null;
        }
        console.log(`Bắt đầu lại...`);
    }
}


checkProxyAndRun();
