const { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const EventEmitter = require('events');
const qrcode = require('qrcode-terminal');  // Add this

class WhatsAppBot extends EventEmitter {
    constructor() {
        super();
        this.sock = null;
        this.sendMessageToNumberFunc = null;
    }

    async start() {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
        const { version } = await fetchLatestBaileysVersion();

        this.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Show QR in terminal visually
                qrcode.generate(qr, { small: true });
                // Also emit the QR string for any external listener
                this.emit('qr', qr);
                console.log('Scan this QR code with your WhatsApp mobile app');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('Connection closed. Status code:', statusCode);

                // If logged out, delete session files so it forces a fresh login next time
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('You are logged out. Clearing auth state...');
                    const fs = require('fs');
                    const authFolder = './auth_info_baileys';
                    if (fs.existsSync(authFolder)) {
                        fs.rmSync(authFolder, { recursive: true, force: true });
                    }
                    process.exit(0);  // Stops the bot; restart manually to get a new QR
                } else {
                    console.log('Reconnecting in 5 seconds...');
                    setTimeout(() => this.start(), 5000);
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp bot connected!');
            }
        });

        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const msg = messages[0];
                if (!msg.message || msg.key.fromMe) return;

                const sender = msg.key.remoteJid;
                const text = msg.message.conversation || msg.message?.extendedTextMessage?.text || '';

                console.log(`📥 Message from ${sender}: ${text}`);

                if (text.toLowerCase() === 'hi') {
                    await this.sock.sendMessage(sender, { text: 'Hello! 👋' });
                }
            } catch (err) {
                console.error('Error handling message:', err);
            }
        });

        this.sendMessageToNumberFunc = async (number, message) => {
            const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
            await this.sock.sendMessage(jid, { text: message });
            console.log(`📤 Sent to ${number}: ${message}`);
        };
    }

    async sendMessage(number, message) {
        if (!this.sendMessageToNumberFunc) throw new Error('Bot not connected yet');
        await this.sendMessageToNumberFunc(number, message);
    }
}

module.exports = WhatsAppBot;
