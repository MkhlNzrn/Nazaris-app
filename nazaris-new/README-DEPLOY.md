# Деплой NAZARIS на Ubuntu Server

## Быстрый старт

1. Загрузите файлы на сервер:
```bash
scp -r nazaris-new/ user@your-server:/tmp/
```

2. Подключитесь к серверу:
```bash
ssh user@your-server
```

3. Перейдите в директорию и запустите скрипт деплоя:
```bash
cd /tmp/nazaris-new
chmod +x deploy.sh
./deploy.sh
```

## Ручная установка

### 1. Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Установка PM2

```bash
sudo npm install -g pm2
```

### 3. Копирование файлов

```bash
sudo mkdir -p /var/www/nazaris
sudo chown -R $USER:$USER /var/www/nazaris
cp -r nazaris-new/* /var/www/nazaris/
cd /var/www/nazaris
```

### 4. Установка зависимостей

```bash
npm install --production
```

### 5. Настройка переменных окружения

Создайте файл `.env`:

```bash
nano .env
```

Содержимое:
```
PORT=8888
NODE_ENV=production
EMAIL_TO=nazaris@internet.ru
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=nazaris@internet.ru
EMAIL_PASS=your_password_here
```

### 6. Запуск с PM2

```bash
pm2 start server.js --name nazaris
pm2 save
pm2 startup
```

### 7. Настройка Nginx (опционально)

Создайте файл `/etc/nginx/sites-available/nazaris`:

```nginx
server {
    listen 80;
    server_name nazaris.ru www.nazaris.ru;

    location / {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте сайт:
```bash
sudo ln -s /etc/nginx/sites-available/nazaris /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Настройка SSL (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d nazaris.ru -d www.nazaris.ru
```

### 9. Настройка файрвола

```bash
sudo ufw allow 8888/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Управление приложением

- Проверить статус: `pm2 status`
- Просмотр логов: `pm2 logs nazaris`
- Перезапуск: `pm2 restart nazaris`
- Остановка: `pm2 stop nazaris`
- Удаление: `pm2 delete nazaris`

## Обновление приложения

```bash
cd /var/www/nazaris
git pull  # если используете git
# или загрузите новые файлы
npm install --production
pm2 restart nazaris
```

## Мониторинг

PM2 предоставляет встроенный мониторинг:
```bash
pm2 monit
```

## Резервное копирование

Рекомендуется настроить автоматическое резервное копирование:
```bash
# Пример cron задачи для ежедневного бэкапа
0 2 * * * tar -czf /backup/nazaris-$(date +\%Y\%m\%d).tar.gz /var/www/nazaris
```
