FROM node:20-alpine AS builder

WORKDIR /app

# Copy package file first for caching
COPY package.json ./
RUN npm install

# Copy application code
COPY . .

# Build the React app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
