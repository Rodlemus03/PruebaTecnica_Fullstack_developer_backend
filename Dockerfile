FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx sequelize-cli db:migrate && node scripts/importExcel.js --if-empty && node src/server.js"]
