FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm ci

# 웹앱 빌드
RUN npm run build --workspace @weddingpick/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@weddingpick/api"]
