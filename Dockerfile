FROM node:20-bullseye-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run prisma:generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
