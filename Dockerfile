FROM node:20-slim

WORKDIR /app

# Install all deps (including devDeps needed for the Vite build)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build the frontend
COPY . .
RUN npm run build

# Prune devDeps — keep only what the server needs at runtime
RUN npm prune --omit=dev

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
