async function getRandomTime(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}
async function generateRandomUserName() {
    const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Võ", "Đặng"];
    const middleNames = ["Việt", "Thị", "Văn", "Hồng", "Minh", "Quang", "Thanh", "Anh"];
    const firstNames = ["Tùng", "Hùng", "Lan", "Anh", "Bình", "Dũng", "Sơn", "Phương"];

    function getRandomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    return `${getRandomElement(lastNames)} ${getRandomElement(middleNames)} ${getRandomElement(firstNames)}`;
}

async function generateRandomPhone() {
    const prefixes = ["096", "097", "098", "086", "032", "034", "035", "036"];

    function getRandomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function generateRandomDigits(length) {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += Math.floor(Math.random() * 10);
        }
        return result;
    }

    return `${getRandomElement(prefixes)}${generateRandomDigits(7)}`;
}

async function generateCardCode() {
    const letters = "TYAUPKEHFCDMRNWX";
    const numbers = "23479";

    function getRandomElement(str) {
        return str[Math.floor(Math.random() * str.length)];
    }

    const numCount = Math.floor(Math.random() * 3) + 1;
    const letterCount = 6 - numCount;

    let cardCodeArray = [];

    for (let i = 0; i < letterCount; i++) {
        cardCodeArray.push(getRandomElement(letters));
    }

    for (let i = 0; i < numCount; i++) {
        cardCodeArray.push(getRandomElement(numbers));
    }

    for (let i = cardCodeArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardCodeArray[i], cardCodeArray[j]] = [cardCodeArray[j], cardCodeArray[i]];
    }

    return cardCodeArray.join('');
}

module.exports = {
    generateCardCode,
    generateRandomPhone,
    getRandomTime,
    generateRandomUserName
};
