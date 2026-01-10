# ---- Base image ----
FROM node:18-alpine

# ---- Create app directory ----
WORKDIR /usr/src/app

# ---- Install dependencies first (better caching) ----
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# ---- Copy application source ----
COPY . .

# ---- Expose app port ----
EXPOSE 3001

# ---- Start app ----
CMD ["node", "index.js"]
