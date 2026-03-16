import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, LocalAuth } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Inaanzisha WhatsApp Bot...');

const config = {
    minTypingTime: 3000,
    maxTypingTime: 8000,
    minDelayBetweenMessages: 4000,
    maxDelayBetweenMessages: 10000,
    maxMessagesPerMinute: 5,
    sessionPath: path.join(__dirname, 'session-data'),
    maxResults: 20,
    apiUrl: 'https://swaflix.com/api/v3/search.php',
    watchUrl: 'https://swaflix.com/watch.php?id='
};

if (!fs.existsSync(config.sessionPath)) {
    fs.mkdirSync(config.sessionPath, { recursive: true });
}

class RateLimiter {
    constructor() {
        this.userTimestamps = new Map();
        this.messageCount = new Map();
    }
    canSend(userNumber) {
        const now = Date.now();
        const last = this.userTimestamps.get(userNumber) || 0;
        const count = this.messageCount.get(userNumber) || 0;
        if (now - last < 60000 && count >= config.maxMessagesPerMinute) return false;
        if (now - last > 60000) this.messageCount.set(userNumber, 1);
        else this.messageCount.set(userNumber, count + 1);
        this.userTimestamps.set(userNumber, now);
        return true;
    }
}

const rateLimiter = new RateLimiter();
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

async function humanLikeTyping(chat) {
    const typingTime = randomDelay(config.minTypingTime, config.maxTypingTime);
    await chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, typingTime));
}

const messageQueue = [];
let isProcessingQueue = false;

async function processMessageQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;
    while (messageQueue.length > 0) {
        const { chat, text, replyTo } = messageQueue.shift();
        try {
            await humanLikeTyping(chat);
            if (replyTo) await replyTo.reply(text);
            else await chat.sendMessage(text);
            await new Promise(resolve => setTimeout(resolve, randomDelay(4000, 10000)));
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }
    isProcessingQueue = false;
}

async function searchMovies(query) {
    try {
        const response = await fetch(`${config.apiUrl}?s=${encodeURIComponent(query)}`);
        const data = await response.json();
        const filtered = data.filter(item => item.Title.toLowerCase().includes(query.toLowerCase()));
        return filtered.slice(0, config.maxResults);
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

const searchTriggers = ['drama', 'action', 'comedy', 'horror', 'thriller', 'romance', 'search', 'tafuta'];

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "md-bot",
        dataPath: config.sessionPath
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', (qr) => {
    console.log('\n📱 SCAN QR CODE HII KWA WHATSAPP YAKO!\n');
    qrcode.generate(qr, { small: false });
    fs.writeFileSync(path.join(__dirname, 'qr-code.txt'), qr);
});

client.on('ready', () => {
    console.log('✅ BOT IKO TAYARI!');
    console.log('📱 Tuma: drama, action, comedy, horror, search [jina]');
});

const userSearches = new Map();

client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const userNumber = message.from;
        const text = message.body.trim().toLowerCase();
        
        if (message.fromMe) return;
        if (!rateLimiter.canSend(userNumber)) return;

        if (userSearches.has(userNumber) && /^\d+$/.test(text)) {
            const results = userSearches.get(userNumber);
            const index = parseInt(text) - 1;
            if (index >= 0 && index < results.length) {
                const selected = results[index];
                const reply = `🎬 *${selected.Title}*\n\n📖 ${selected.Description}\n\n🔗 ${config.watchUrl}${selected.tmdbid}`;
                messageQueue.push({ chat, text: reply, replyTo: message });
                processMessageQueue();
                userSearches.delete(userNumber);
            }
            return;
        }

        const shouldSearch = searchTriggers.some(t => text.startsWith(t + ' ') || text === t);
        if (shouldSearch) {
            let query = text.includes(' ') ? text.split(' ').slice(1).join(' ') : text;
            const results = await searchMovies(query);
            if (results.length === 0) {
                messageQueue.push({ chat, text: `😕 Hakuna matokeo ya "${query}"`, replyTo: message });
                processMessageQueue();
                return;
            }
            userSearches.set(userNumber, results);
            let reply = `🔍 *Matokeo ya "${query}"*\n\n`;
            results.forEach((item, i) => reply += `${i+1}. *${item.Title}*\n`);
            reply += `\n⏱️ Tuma namba (1-${results.length})`;
            messageQueue.push({ chat, text: reply, replyTo: message });
            processMessageQueue();
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

client.initialize();
