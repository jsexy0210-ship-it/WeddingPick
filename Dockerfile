FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@weddingpick/api"]
