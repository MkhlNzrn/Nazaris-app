#!/bin/bash

# NAZARIS Deployment Script for Ubuntu Server
# Usage: ./deploy.sh

set -e

echo "🚀 Starting NAZARIS deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root${NC}"
   exit 1
fi

# Variables
APP_DIR="/var/www/nazaris"
SERVICE_NAME="nazaris"
PORT=8888
NODE_VERSION="18.x"

echo -e "${GREEN}✓ Checking system requirements...${NC}"

# Update system
sudo apt-get update -qq

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    sudo npm install -g pm2
fi

# Create app directory
echo -e "${GREEN}✓ Creating application directory...${NC}"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Copy files
echo -e "${GREEN}✓ Copying application files...${NC}"
cp -r . $APP_DIR/
cd $APP_DIR

# Install dependencies
echo -e "${GREEN}✓ Installing dependencies...${NC}"
npm install --production

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
PORT=8888
NODE_ENV=production
EMAIL_TO=nazaris@internet.ru
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=nazaris@internet.ru
EMAIL_PASS=
EOF
    echo -e "${YELLOW}⚠️  Please edit .env file with your email credentials${NC}"
fi

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '${SERVICE_NAME}',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: ${PORT}
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Stop existing PM2 process if running
pm2 delete $SERVICE_NAME 2>/dev/null || true

# Start application with PM2
echo -e "${GREEN}✓ Starting application with PM2...${NC}"
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo -e "${GREEN}✓ Setting up PM2 startup script...${NC}"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# Setup Nginx (optional)
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✓ Nginx detected. Creating configuration...${NC}"
    sudo tee /etc/nginx/sites-available/${SERVICE_NAME} > /dev/null << EOF
server {
    listen 80;
    server_name nazaris.ru www.nazaris.ru;

    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nazaris.ru www.nazaris.ru;

    ssl_certificate /etc/letsencrypt/live/nazaris.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nazaris.ru/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:${PORT};
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/${SERVICE_NAME} /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx configuration created${NC}"
    echo -e "${YELLOW}⚠️  Don't forget to setup SSL certificate with Let's Encrypt:${NC}"
    echo -e "${YELLOW}   sudo certbot --nginx -d nazaris.ru -d www.nazaris.ru${NC}"
fi

# Setup firewall (UFW)
if command -v ufw &> /dev/null; then
    echo -e "${GREEN}✓ Configuring firewall...${NC}"
    sudo ufw allow ${PORT}/tcp comment 'NAZARIS Node.js'
    sudo ufw allow 80/tcp comment 'HTTP'
    sudo ufw allow 443/tcp comment 'HTTPS'
    sudo ufw --force enable
fi

echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo -e "${GREEN}Application is running on port ${PORT}${NC}"
echo -e "${YELLOW}Check status: pm2 status${NC}"
echo -e "${YELLOW}View logs: pm2 logs ${SERVICE_NAME}${NC}"
echo -e "${YELLOW}Restart: pm2 restart ${SERVICE_NAME}${NC}"
