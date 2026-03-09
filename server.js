const http = require('node:http');
const path = require('node:path');
const { stat } = require('node:fs/promises');
const { createReadStream } = require('node:fs');

const PORT = 2033;
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    
    const getStats = async (p) => {
        try {
            const s = await stat(p);
            return s.isFile() ? s : null;
        } catch {
            return null;
        }
    };

    let filePath = path.join(__dirname, urlPath === '/' ? 'public/index.html' : urlPath);
    let ext = path.extname(filePath).toLowerCase();
    let stats = await getStats(filePath);

    if (!stats) {
        filePath = path.join(__dirname, 'public', urlPath);
        ext = path.extname(filePath).toLowerCase();
        stats = await getStats(filePath);
    }

    if (!stats && (!ext || ext === '')) {
        filePath = path.join(__dirname, 'public', 'index.html');
        ext = '.html';
        stats = await getStats(filePath);
    }

    if (stats) {
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Ошибка 404: Файл ${urlPath} не найден`);
    }
});

server.listen(PORT, () => {
    console.log(`Сервер: http://localhost:${PORT}`);
});
