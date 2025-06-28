const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const qrcode = require('qrcode');
const fs = require('fs');

const WhatsAppBot = require('./index');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));

const bot = new WhatsAppBot();

let latestQrString = null;
let connectionStatus = 'disconnected';

bot.on('qr', (qr) => {
    latestQrString = qr;
    console.log('QR code updated');
});

bot.on('connection', ({status}) => {
    connectionStatus = status;
    if (status === 'open') {
        console.log('WhatsApp bot connected!');
        latestQrString = null; // Clear QR after connected
    } else if (status === 'close') {
        console.log('WhatsApp bot disconnected!');
    }
});

// Start WhatsApp bot
bot.start();
app.get('/', async (req, res) => {
    let qrImage = null;
    if (latestQrString) {
        qrImage = await qrcode.toDataURL(latestQrString);
    }

    fs.readFile(path.join(__dirname, 'public', 'form.html'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Could not load form.html');
            return;
        }

        // Inject QR image and status dynamically
        const htmlWithStatus = data
            .replace('{{STATUS}}', connectionStatus)
            .replace('{{QR_IMAGE}}', qrImage
                ? `<img src="${qrImage}" alt="QR Code" />`
                : '<p>QR code scanned or not available.</p>');

        res.send(htmlWithStatus);
    });
});

app.post('/send-message', async (req, res) => {
    const {phone, message} = req.body;

    try {
        await bot.sendMessage(phone, message);
        res.send(`<p>✅ Message sent to ${phone}</p><a href="/">Back</a>`);
    } catch (error) {
        console.error(error);
        res.status(500).send(`<p>❌ Failed to send message: ${error.message}</p><a href="/">Back</a>`);
    }
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
