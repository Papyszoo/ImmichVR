FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for clean dependency installation
# Use 'docker build --no-cache' or 'docker-compose build --no-cache' to ensure fresh build
COPY package.json package-lock.json ./
RUN npm ci

# Copy application code
COPY . .

# Build the React app with Vite
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
