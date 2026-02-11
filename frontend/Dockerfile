# Multi-stage build for production-optimized React frontend
FROM node:18-alpine AS base

WORKDIR /app

# ============================================================================
# Dependencies stage
# ============================================================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# ============================================================================
# Build stage
# ============================================================================
FROM base AS build

# Copy node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ============================================================================
# Production stage with Nginx
# ============================================================================
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
