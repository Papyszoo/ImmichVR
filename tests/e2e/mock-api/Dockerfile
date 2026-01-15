FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy application files
COPY server.js ./
COPY data ./data

# Expose Immich standard port
EXPOSE 2283

# Start the server
CMD ["node", "server.js"]
