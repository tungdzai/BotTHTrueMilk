require('dotenv').config();
const axios = require('axios');
const key = process.env.KEY_PROXY_VN;
const typeProxy = process.env.TYPE_PROXY;
let cachedProxies = null;

async function getProxyVN() {
    const typesArray = JSON.parse(typeProxy);
    let allProxies = [];

    for (const typeProxy of typesArray) {
        const url = `https://proxy.vn/api/listproxy.php?key=${key}&loaiproxy=${typeProxy}`;
        try {
            const response = await axios.get(url);

            if (!response.data || response.data.trim() === "") {
                console.warn(`Dữ liệu proxy từ ${typeProxy} rỗng, bỏ qua.`);
                continue;
            }

            const proxies = response.data
                .split('}{')
                .map((str, index, arr) => {
                    if (index === 0) return JSON.parse(`${str}}`);
                    if (index === arr.length - 1) return JSON.parse(`{${str}`);
                    return JSON.parse(`{${str}}`);
                });
            const proxyList = proxies.map(proxyObj => proxyObj.proxy);
            allProxies = [...allProxies, ...proxyList];
        } catch (error) {
            console.error(`Lỗi khi lấy proxy từ ${typeProxy}:`, error.message);
        }
    }
    cachedProxies = allProxies;
    return cachedProxies;
}
module.exports = {getProxyVN};