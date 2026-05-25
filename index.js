const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const yts = require('yt-search');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- SaveTube Logic (The "Proxy") ---
const savetube = {
    api: { base: "https://media.savetube.me/api", cdn: "/random-cdn", info: "/v2/info", download: "/download" },
    headers: { 'user-agent': 'Postify/1.0.0', 'content-type': 'application/json' },
    crypto: {
        hexToBuffer: (h) => Buffer.from(h.match(/.{1,2}/g).join(''), 'hex'),
        decrypt: async (enc) => {
            const data = Buffer.from(enc, 'base64');
            const key = savetube.crypto.hexToBuffer('C5D58EF67A7584E4A29F6C35BBC4EB12');
            const decipher = crypto.createDecipheriv('aes-128-cbc', key, data.slice(0, 16));
            let decrypted = Buffer.concat([decipher.update(data.slice(16)), decipher.final()]);
            return JSON.parse(decrypted.toString());
        }
    },
    download: async (url) => {
        const id = url.split('v=')[1] || url.split('/').pop();
        const cdn = (await axios.get(savetube.api.base + savetube.api.cdn)).data.cdn;
        const info = await axios.post(`https://${cdn}${savetube.api.info}`, { url: `https://www.youtube.com/watch?v=${id}` }, { headers: savetube.headers });
        const decrypted = await savetube.crypto.decrypt(info.data.data);
        const dl = await axios.post(`https://${cdn}${savetube.api.download}`, { id, downloadType: 'audio', quality: '128', key: decrypted.key }, { headers: savetube.headers });
        return dl.data.data.downloadUrl;
    }
};

// --- API Route ---
app.get('/play', async (req, res) => {
    try {
        const query = req.query.q;
        const { videos } = await yts(query);
        const url = await savetube.download(videos[0].url);
        
        // Stream directly to the bot
        const response = await axios({ url, method: 'GET', responseType: 'stream' });
        res.header('Content-Type', 'audio/mpeg');
        response.data.pipe(res);
    } catch (err) {
        res.status(500).send("Error fetching audio");
    }
});

app.listen(PORT, () => console.log(`Music Server live on port ${PORT}`));
