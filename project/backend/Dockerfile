FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 2001
ENTRYPOINT ["node", "src/app.js"]
