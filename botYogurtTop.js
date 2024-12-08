require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const {getProxiesData, requests, batchSize} = require('./proxy');
const {generateCardCode, generateRandomPhone, getRandomTime} = require('./handlers');
const cheerio = require('cheerio');
const {HttpsProxyAgent} = require('https-proxy-agent');

let cachedProxies = null;
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT; // 10 giây timeout cho mỗi request
const MAX_RUNTIME = process.env.MAX_RUNTIME; // Giới hạn thời gian chạy tối đa

async function getCachedProxies() {
    if (cachedProxies) return cachedProxies;

    const proxiesData = await getProxiesData();
    if (!proxiesData || proxiesData.length === 0) {
        console.error('Không có proxy nào để sử dụng');
        return null;
    }
    console.log(`Số proxy hoạt động: ${proxiesData.length}`);
    cachedProxies = proxiesData;
    return cachedProxies;
}

async function getProxyGroups() {
    const proxiesData = await getCachedProxies();
    if (!proxiesData || proxiesData.length === 0) return [];

    const groupSize = 25; // Mỗi nhóm gồm 25  proxy
    const proxyGroups = [];
    for (let i = 0; i < proxiesData.length; i += groupSize) {
        proxyGroups.push(proxiesData.slice(i, i + groupSize));
    }
    return proxyGroups;
}
async function httpsProxyAgent(proxy) {
    let proxyHost, proxyPort, proxyUser, proxyPassword;

    if (typeof proxy === 'string') {
        const proxyParts = proxy.split(':');
        if (proxyParts.length === 2) {
            [proxyHost, proxyPort] = proxyParts;
            proxyUser = '';
            proxyPassword = '';
        } else if (proxyParts.length === 4) {
            [proxyHost, proxyPort, proxyUser, proxyPassword] = proxyParts;
        } else {
            console.error('Proxy khong đúng định dạng');
            return null;
        }
    } else {
        console.error('Không tồn tại proxy kiểm tra lại ');
        return null;
    }

    const proxyUrl = `http://${proxyUser}:${proxyPassword}@${proxyHost}:${proxyPort}`;
    return new HttpsProxyAgent(proxyUrl);
}
async function withTimeout(promise, timeout) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout exceeded')), timeout)
        ),
    ]);
}

async function getHome(requestData, agent) {
    try {
        const response = await withTimeout(
            await axios.get(requestData.origin, {
                headers: {
                    'Host': requestData.host,
                    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    'accept': '*/*',
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'x-requested-with': 'XMLHttpRequest',
                    'sec-ch-ua-mobile': '?1',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                    'sec-ch-ua-platform': '"Android"',
                    'origin': requestData.origin,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': requestData.referer,
                    'accept-encoding': 'gzip, deflate, br, zstd',
                    'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                    'priority': 'u=1',
                },
                withCredentials: true,
                httpAgent: agent,
                httpsAgent: agent
            }),
            REQUEST_TIMEOUT
        );

        const html = response.data;
        const $ = cheerio.load(html);
        const requestVerificationToken = $('input[name="__RequestVerificationToken"]').val();
        const cookies = response.headers['set-cookie'];
        if (!requestVerificationToken && !cookies) {
            console.error('Không tìm thấy __RequestVerificationToken:', html);
            return null;
        }
        return {
            requestVerificationToken,
            cookies,
        };
    } catch (error) {
        console.error(`getHome lỗi: Timeout exceeded với request ${JSON.stringify(requestData)}`);
        return null;
    }
}

async function handleYogurtTop(requestData, requestVerificationToken, cookies, agent, retries = 2) {
    if (retries < 0) {
        return null
    }

    try {
        const phone = await generateRandomPhone();
        const postData = `Code=${requestData.gift}&Phone=${phone}`;
        const response = await withTimeout(
            axios.post(requestData.url, postData, {
                headers: {
                    'RequestVerificationToken': requestVerificationToken,
                    'Host': requestData.host,
                    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    'accept': '*/*',
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'x-requested-with': 'XMLHttpRequest',
                    'sec-ch-ua-mobile': '?1',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                    'sec-ch-ua-platform': '"Android"',
                    'origin': requestData.origin,
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': requestData.referer,
                    'accept-encoding': 'gzip, deflate, br, zstd',
                    'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                    'priority': 'u=1',
                    'Cookie': cookies,
                },
                httpAgent: agent,
                httpsAgent: agent
            }),
            REQUEST_TIMEOUT
        );
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.warn('Quá nhiều request, chờ trước khi retry...');

            let delay;
            if (retries === 2) {
                delay = 1000; // 2s
            } else if (retries === 1) {
                delay = 2000; // 3s
            } else {
                delay = 3000; // 4s
            }

            await new Promise(resolve => setTimeout(resolve, delay));
            return await handleYogurtTop(requestData, requestVerificationToken, cookies, agent, retries - 1);
        }
        console.error('handleYogurtTop lỗi:', error.response ? error.response.status : error.message);
        return null;
    }
}

async function sendDataToAPI(code, batchNumber,proxy) {
    try {
        const dataList = [
            {
                url: 'https://quatangtopkid.thmilk.vn/Home/CheckCode',
                gift: `TY4${code}`,
                host: 'quatangtopkid.thmilk.vn',
                origin: 'https://quatangtopkid.thmilk.vn',
                referer: 'https://quatangtopkid.thmilk.vn/'
            },
            {
                url: 'https://quatangyogurt.thmilk.vn/Home/CheckCode',
                gift: `YE4${code}`,
                host: 'quatangyogurt.thmilk.vn',
                origin: 'https://quatangyogurt.thmilk.vn',
                referer: 'https://quatangyogurt.thmilk.vn/'
            }
        ];
        for (const requestData of dataList) {
            const agent = await httpsProxyAgent(proxy);
            if (agent) {
                const homeResult = await getHome(requestData, agent);
                if (!homeResult) {
                    console.error('Không lấy được token và cookies từ getHome');
                    return null;
                }
                const {requestVerificationToken, cookies} = homeResult;
                const response = await handleYogurtTop(requestData, requestVerificationToken, cookies, agent);
                if (response !== null) {
                    const status = response.Type;
                    const message = response.Message;
                    if (status !== 'error') {
                        // Ghi mã vào file data.txt
                        fs.appendFileSync('data.txt', `${requestData.gift}\n`, 'utf8');
                        console.log(`Đã ghi mã ${requestData.gift} vào file data.txt`);
                    }
                    console.log(`[Batch ${batchNumber}] ${agent.proxy.hostname} ${requestData.gift} ${message}`);
                }
            }
        }
    } catch (error) {
        console.error('sendDataToAPI lỗi:', error.response ? error.response.status : error.message);
        return null;
    }
}

async function runBatch(batchNumber, proxyGroup, signal) {
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
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
        // Chờ tất cả các request hoàn thành hoặc timeout
        await withTimeout(Promise.allSettled(promises), REQUEST_TIMEOUT * 6);
        console.log(`Batch ${batchNumber} đã hoàn thành`);
    } catch (error) {
        console.error(`Batch ${batchNumber} bị treo quá lâu và đã bị bỏ qua.`);
    }
}

async function runIndependentRequests(requests, signal, proxyGroups) {
    const batchPromises = [];

    for (let i = 0; i < requests; i++) {
        if (signal.aborted) throw new Error('AbortError');
        const proxyGroup = proxyGroups[i]; // Nhóm proxy tương ứng với luồng
        batchPromises.push(runBatch(i + 1, proxyGroup, signal));
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
            await runIndependentRequests(requests, signal, proxyGroups);
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
