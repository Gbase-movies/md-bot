import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, LocalAuth } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIGURATION ====================
const config = {
    // Anti-ban settings
    minTypingTime: 3000,
    maxTypingTime: 8000,
    minDelayBetweenMessages: 4000,
    maxDelayBetweenMessages: 10000,
    maxMessagesPerMinute: 5,
    
    // Session settings - jina la kawaida tu
    sessionPath: path.join(__dirname, 'session-data'),
    
    // Search settings
    maxResults: 20,
    
    // API - hii inabaki sawa kwa sababu ni URL yako
    apiUrl: 'https://swaflix.com/api/v3/search.php',
    watchUrl: 'https://swaflix.com/watch.php?id='
};

// ==================== INITIALIZATION ====================
console.log('🚀 ==================================');
console.log('🚀 Inaanzisha WhatsApp Bot...');
console.log('🚀 ==================================');

// Create session directory
if (!fs.existsSync(config.sessionPath)) {
    fs.mkdirSync(config.sessionPath, { recursive: true });
    console.log('📁 Session directory created');
}

// ==================== RATE LIMITER ====================
class RateLimiter {
    constructor() {
        this.userTimestamps = new Map();
        this.messageCount = new Map();
    }

    canSend(userNumber) {
        const now = Date.now();
        const last = this.userTimestamps.get(userNumber) || 0;
        const count = this.messageCount.get(userNumber) || 0;
        
        if (now - last < 60000 && count >= config.maxMessagesPerMinute) {
            return false;
        }
        
        if (now - last > 60000) {
            this.messageCount.set(userNumber, 1);
        } else {
            this.messageCount.set(userNumber, count + 1);
        }
        
        this.userTimestamps.set(userNumber, now);
        return true;
    }
}

const rateLimiter = new RateLimiter();

// ==================== UTILITY FUNCTIONS ====================
const randomDelay = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

async function humanLikeTyping(chat) {
    const typingTime = randomDelay(config.minTypingTime, config.maxTypingTime);
    await chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, typingTime));
}

// ==================== MESSAGE QUEUE ====================
const messageQueue = [];
let isProcessingQueue = false;

async function processMessageQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    
    isProcessingQueue = true;
    console.log(`📤 Processing queue (${messageQueue.length} messages)`);
    
    while (messageQueue.length > 0) {
        const { chat, text, replyTo } = messageQueue.shift();
        
        try {
            await humanLikeTyping(chat);
            if (replyTo) {
                await replyTo.reply(text);
            } else {
                await chat.sendMessage(text);
            }
            
            const delay = randomDelay(
                config.minDelayBetweenMessages, 
                config.maxDelayBetweenMessages
            );
            console.log(`⏱️ Waiting ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }
    
    isProcessingQueue = false;
    console.log('✅ Queue processing complete');
}

// ==================== SEARCH FUNCTION ====================
async function searchMovies(query) {
    try {
        console.log(`🔍 Searching for: "${query}"`);
        const response = await fetch(`${config.apiUrl}?s=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const filtered = data.filter(item => 
            item.Title.toLowerCase().includes(query.toLowerCase())
        );
        
        console.log(`📊 Found ${filtered.length} results`);
        return filtered.slice(0, config.maxResults);
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

// ==================== SEARCH TRIGGERS ====================
const searchTriggers = [
    'drama', 'action', 'comedy', 'horror', 'thriller', 
    'romance', 'adventure', 'crime', 'fantasy', 'mystery',
    'search', 'tafuta', 'movie', 'film', 'sinema'
];

// ==================== CLIENT CONFIGURATION ====================
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "md-bot-prod", // Jina la kawaida tu
        dataPath: config.sessionPath
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    }
});

// ==================== CLIENT EVENTS ====================
client.on('qr', (qr) => {
    console.log('\n📱 ==================================');
    console.log('📱 SCAN QR CODE HII KWA WHATSAPP YAKO!');
    console.log('📱 ==================================\n');
    qrcode.generate(qr, { small: false });
    
    fs.writeFileSync(path.join(__dirname, 'qr-code.txt'), qr);
    console.log('\n💾 QR code saved to qr-code.txt');
});

client.on('authenticated', () => {
    console.log('✅ ==================================');
    console.log('✅ IMEFAULU KUNGIA!');
    console.log('✅ ==================================');
});

client.on('auth_failure', msg => {
    console.error('❌ ==================================');
    console.error('❌ Kuna tatizo la kuingia:', msg);
    console.error('❌ ==================================');
});

client.on('ready', () => {
    console.log('✅ ==================================');
    console.log('✅ BOT IKO TAYARI!');
    console.log('✅ ==================================');
    console.log('\n🔍 Commands:');
    console.log('   • drama - Tafuta drama movies');
    console.log('   • action - Tafuta action movies');
    console.log('   • search [jina] - Tafuta movie yoyote');
    console.log('   • horror, comedy, romance, etc.\n');
    
    if (client.info) {
        console.log(`📱 Connected as: ${client.info.pushname}`);
        console.log(`📱 Phone: ${client.info.me.user}`);
        console.log(`📱 Platform: ${client.info.platform}\n`);
    }
});

client.on('disconnected', (reason) => {
    console.log('⚠️ ==================================');
    console.log('⚠️ Bot imetengwa:', reason);
    console.log('⚠️ ==================================');
});

// ==================== MESSAGE HANDLER ====================
const userSearches = new Map();

client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const userNumber = message.from;
        const text = message.body.trim().toLowerCase();
        
        console.log(`\n📨 [${new Date().toLocaleTimeString()}] ${userNumber}: ${text}`);

        if (message.fromMe) return;

        if (!rateLimiter.canSend(userNumber)) {
            console.log('⏳ Rate limited');
            messageQueue.push({
                chat,
                text: "⏳ Pole pole, unaandika haraka sana. Subiri kidogo.",
                replyTo: message
            });
            processMessageQueue();
            return;
        }

        if (userSearches.has(userNumber) && /^\d+$/.test(text)) {
            const searchResults = userSearches.get(userNumber);
            const index = parseInt(text) - 1;
            
            if (index >= 0 && index < searchResults.length) {
                const selected = searchResults[index];
                const watchLink = `${config.watchUrl}${selected.tmdbid}`;
                
                let reply = `🎬 *${selected.Title}*\n\n`;
                reply += `📖 *Description:*\n${selected.Description}\n\n`;
                reply += `🔗 *Watch Online:*\n${watchLink}\n`;
                
                messageQueue.push({
                    chat,
                    text: reply,
                    replyTo: message
                });
                processMessageQueue();
                
                userSearches.delete(userNumber);
                console.log(`✅ Sent details for: ${selected.Title}`);
            } else {
                messageQueue.push({
                    chat,
                    text: "❌ Namba si sahihi. Tafadhali jaribu tena.",
                    replyTo: message
                });
                processMessageQueue();
            }
            return;
        }

        const shouldSearch = searchTriggers.some(trigger => 
            text.startsWith(trigger + ' ') || text === trigger
        );

        if (shouldSearch) {
            let query = text;
            if (text.includes(' ')) {
                const parts = text.split(' ');
                query = parts.slice(1).join(' ');
            }
            
            if (!query || query.trim() === '') {
                query = text.split(' ')[0];
            }
            
            console.log(`🔍 Processing search for: "${query}"`);
            
            const results = await searchMovies(query);
            
            if (results.length === 0) {
                messageQueue.push({
                    chat,
                    text: `😕 Samahani, hakuna matokeo ya "${query}" yaliyopatikana.`,
                    replyTo: message
                });
                processMessageQueue();
                return;
            }

            userSearches.set(userNumber, results);
            
            let reply = `🔍 *Matokeo ya utafutaji "${query}"*\n\n`;
            reply += `📋 *Chagua namba ya movie unayotaka:*\n\n`;
            
            results.forEach((item, index) => {
                reply += `${index + 1}. *${item.Title}*\n`;
            });
            
            reply += `\n⏱️ *Tuma namba (1-${results.length}) kupata maelezo na kiungo.*`;
            
            messageQueue.push({
                chat,
                text: reply,
                replyTo: message
            });
            processMessageQueue();
            
            console.log(`📋 Sent ${results.length} results`);
        }

    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// ==================== MAINTENANCE TASKS ====================

setInterval(() => {
    console.log('\n🔄 ==================================');
    console.log('🔄 Checking session health...');
    console.log('🔄 ==================================');
    
    if (client.info) {
        console.log(`✅ Session active for: ${client.info.pushname}`);
        console.log(`✅ Uptime: ${process.uptime().toFixed(0)} seconds`);
    } else {
        console.log('⚠️ Session not active, attempting reconnect...');
    }
}, 30 * 60 * 1000);

setInterval(() => {
    const size = userSearches.size;
    userSearches.clear();
    console.log(`\n🧹 Cleaned up ${size} old search sessions`);
}, 60 * 60 * 1000);

setInterval(() => {
    const used = process.memoryUsage();
    console.log('\n📊 ==================================');
    console.log('📊 Memory Usage:');
    console.log('📊 ==================================');
    console.log(`💾 RSS: ${Math.round(used.rss / 1024 / 1024)} MB`);
    console.log(`💾 Heap: ${Math.round(used.heapUsed / 1024 / 1024)}/${Math.round(used.heapTotal / 1024 / 1024)} MB`);
}, 15 * 60 * 1000);

// ==================== START BOT ====================
client.initialize();

// ==================== GRACEFUL SHUTDOWN ====================
async function shutdown(signal) {
    console.log(`\n👋 ==================================`);
    console.log(`👋 Received ${signal}. Closing bot...`);
    console.log(`👋 ==================================`);
    
    try {
        await client.destroy();
        console.log('✅ Bot closed successfully');
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
