const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    
    let filePath = path.join(__dirname, urlPath === '/' ? 'public/index.html' : urlPath);
    
    const ext = path.extname(filePath).toLowerCase();

    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            return fs.createReadStream(filePath).pipe(res);
        }

        const publicPath = path.join(__dirname, 'public', urlPath);
        fs.stat(publicPath, (errPublic, statsPublic) => {
            if (!errPublic && statsPublic.isFile()) {
                const publicExt = path.extname(publicPath).toLowerCase();
                res.writeHead(200, { 'Content-Type': MIME_TYPES[publicExt] || 'application/octet-stream' });
                return fs.createReadStream(publicPath).pipe(res);
            }

            if (!ext || ext === '') {
                const indexHtml = path.join(__dirname, 'public', 'index.html');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                return fs.createReadStream(indexHtml).pipe(res);
            }

            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Ошибка 404: Файл ${urlPath} не найден`);
        });
    });
});

server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});