require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8888;
const EMAIL_TO = process.env.EMAIL_TO || 'nazaris@internet.ru';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
};

function send(res, code, body, contentType) {
  res.writeHead(code, { 'Content-Type': contentType || 'application/json; charset=utf-8' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS for API
  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // API: contact form -> email
  if (pathname === '/api/contact' && req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      let formData = {};
      let hasFile = false;
      let fileName = '';

      if (contentType.includes('multipart/form-data')) {
        // Parse multipart/form-data manually (simplified)
        const boundary = contentType.split('boundary=')[1];
        let body = Buffer.alloc(0);
        for await (const chunk of req) {
          body = Buffer.concat([body, chunk]);
        }
        
        const parts = body.toString().split('--' + boundary);
        for (const part of parts) {
          if (part.includes('Content-Disposition')) {
            const nameMatch = part.match(/name="([^"]+)"/);
            const filenameMatch = part.match(/filename="([^"]+)"/);
            
            if (nameMatch) {
              const fieldName = nameMatch[1];
              const valueMatch = part.match(/\r\n\r\n([\s\S]*?)\r\n--/);
              if (valueMatch) {
                formData[fieldName] = valueMatch[1].trim();
              }
              
              if (filenameMatch) {
                hasFile = true;
                fileName = filenameMatch[1];
                formData[fieldName] = 'Файл прикреплен: ' + fileName;
              }
            }
          }
        }
      } else {
        // JSON fallback
        let body = '';
        for await (const chunk of req) body += chunk;
        formData = JSON.parse(body);
      }

      const { name, phone, email, workType, budget, message, file } = formData;
      
      const workTypeNames = {
        'ux-ui': 'UX/UI дизайн',
        'web-dev': 'Веб-разработка',
        'analytics': 'Аналитика',
        'backend': 'Backend разработка',
        'frontend': 'Frontend разработка',
        'bots': 'Разработка ботов',
        'automation': 'Автоматизация бизнеса',
        'other': 'Другое'
      };

      const text = [
        'Новая заявка с сайта NAZARIS',
        '',
        'Имя: ' + (name || '—'),
        'Телефон: ' + (phone || '—'),
        'Email: ' + (email || 'не указан'),
        'Тип работы: ' + (workTypeNames[workType] || workType || '—'),
        'Бюджет: ' + (budget || 'не указан'),
        '',
        'Дополнительная информация:',
        message || '—',
        '',
        hasFile ? 'Прикреплен файл: ' + fileName : 'Файлы не прикреплены'
      ].join('\n');

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.mail.ru',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER || 'nazaris@internet.ru',
          pass: process.env.EMAIL_PASS
        }
      });

      if (!process.env.EMAIL_PASS) {
        send(res, 500, JSON.stringify({ error: 'Email not configured. Set EMAIL_PASS in .env' }));
        return;
      }

      const mailOptions = {
        from: process.env.EMAIL_USER || 'nazaris@internet.ru',
        to: EMAIL_TO,
        subject: 'Заявка NAZARIS: ' + (name || 'Без имени') + ' — ' + (phone || ''),
        text
      };

      await transporter.sendMail(mailOptions);

      send(res, 200, JSON.stringify({ ok: true }));
    } catch (err) {
      console.error(err);
      send(res, 500, JSON.stringify({ error: 'Send failed' }));
    }
    return;
  }

  // Static: /icon/* (from root icon folder)
  if (pathname.startsWith('/icon/')) {
    const name = pathname.slice('/icon/'.length);
    if (name.includes('..')) {
      send(res, 403, 'Forbidden', 'text/plain');
      return;
    }
    // Try root icon folder first, then local
    const rootIconPath = path.join(__dirname, '..', 'icon', decodeURIComponent(name));
    const localIconPath = path.join(__dirname, 'icon', decodeURIComponent(name));
    let filePath = null;
    
    if (fs.existsSync(rootIconPath) && fs.statSync(rootIconPath).isFile()) {
      filePath = rootIconPath;
    } else if (fs.existsSync(localIconPath) && fs.statSync(localIconPath).isFile()) {
      filePath = localIconPath;
    }
    
    if (!filePath) {
      send(res, 404, 'Not Found', 'text/plain');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Sitemap
  if (pathname === '/sitemap.xml') {
    const filePath = path.join(__dirname, 'sitemap.xml');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      send(res, 404, 'Not Found', 'text/plain');
    }
    return;
  }

  // robots.txt
  if (pathname === '/robots.txt') {
    const filePath = path.join(__dirname, 'robots.txt');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('User-agent: *\nAllow: /\nSitemap: https://nazaris.ru/sitemap.xml\n');
    }
    return;
  }

  // Static: root files
  const filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname.slice(1));
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, 'Not Found', 'text/plain');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log('NAZARIS: http://localhost:' + PORT);
  if (!process.env.EMAIL_PASS) {
    console.log('Форма не будет отправлять письма: задайте EMAIL_PASS в .env');
  }
});
