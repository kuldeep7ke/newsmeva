# syntax=docker/dockerfile:1

# ---------- Stage 1: build frontend ----------
FROM node:24-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: build backend ----------
FROM node:24-alpine AS backend-build
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---------- Stage 3: runtime ----------
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3003
WORKDIR /app/backend

COPY --from=backend-build /build/backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-build /build/backend/dist ./dist
COPY backend/.env.example ./

COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3003
VOLUME ["/app/backend"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3003)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.js"]