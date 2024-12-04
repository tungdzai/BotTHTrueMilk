require('dotenv').config();
const axios = require('axios');
const keyUser = process.env.KEY_WWPROXY_USER;
let cachedProxies = null;

async function getKey() {
    const listKey = [];
    const response = await axios.get(`https://wwproxy.com/api/client/key/list?user_api_key=${keyUser}`);
    for (const item of response.data.data) {
        listKey.push(item.uuid);
    }
    return listKey;
}

async function getProxyCurrent(uuid) {
    const url = `https://wwproxy.com/api/client/proxy/current?key=${uuid}`;
    try {
        const response = await axios.get(url);
        return response.data.data.proxy;
    } catch (error) {
        console.error(`Error fetching current proxy for key: ${uuid}`, error.message);
    }
}

async function getProxiesWw() {
    const uuIds = await getKey();
    if (uuIds.length === 0) {
        console.error("Không có key nào được lấy!");
        return null;
    }

    const proxyPromises = uuIds.map(async (uuid) => {
        const url = `https://wwproxy.com/api/client/proxy/available?key=${uuid}&provinceId=-1`;
        try {
            const response = await axios.get(url);
            return response.data.data.proxy; // Lấy proxy có sẵn
        } catch (error) {
            console.error(`Error fetching available proxy for key: ${uuid}, fallback to current proxy`, error.message);
            return await getProxyCurrent(uuid); // Fallback: Lấy proxy hiện tại
        }
    });

    // Chờ tất cả các promises hoàn thành
    const allProxies = await Promise.all(proxyPromises);

    cachedProxies = allProxies;
    return cachedProxies;
}

module.exports = { getProxiesWw };
