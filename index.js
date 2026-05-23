const express = require('express');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Simple Security: Replace 'my-secret-key' with a strong password in your .env
const API_KEY = process.env.API_KEY || 'my-secret-key';

app.post('/fetch-audio', async (req, res) => {
    // 1. Security Check
    const clientKey = req.headers['x-jarvis-key'];
    if (clientKey !== API_KEY) {
        return res.status(403).send('Unauthorized');
    }

    const { query } = req.body;
    if (!query) return res.status(400).send('Query required');

    try {
        // 2. Search
        const search = await ytSearch(query);
        if (!search.videos.length) return res.status(404).send('Not found');

        const video = search.videos[0];

        // 3. Stream from YouTube directly
        // This pipes the audio directly to the response, avoiding server disk storage
        const stream = ytdl(video.url, { 
            filter: 'audioonly', 
            quality: 'highestaudio' 
        });

        // 4. Set headers for audio file
        res.header('Content-Type', 'audio/mpeg');
        res.header('Content-Disposition', `attachment; filename="${video.title}.mp3"`);

        // 5. Pipe stream to the requester
        stream.pipe(res);

        stream.on('error', (err) => {
            console.error(err);
            if (!res.headersSent) res.status(500).send('Streaming error');
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.listen(PORT, () => console.log(`Music Server running on port ${PORT}`));
