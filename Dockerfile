# Imagem única do FERSA CARE: a API Node.js também entrega o site React.
# Usada pelo docker-compose.yml (serviço "app"). Build: docker compose up --build

# ─── 1. Build do front-end ────────────────────────────────────────────────────
FROM node:24-alpine AS frontend
WORKDIR /app/frontend

# Contatos do suporte entram no build do site (variáveis VITE_ são fixadas aqui).
ARG VITE_SUPORTE_WHATSAPP=5541999999999
ARG VITE_SUPORTE_EMAIL=suporte@fersacare.com.br
ARG VITE_UPLOAD_LIMITE_MB=200
ENV VITE_SUPORTE_WHATSAPP=$VITE_SUPORTE_WHATSAPP \
    VITE_SUPORTE_EMAIL=$VITE_SUPORTE_EMAIL \
    VITE_UPLOAD_LIMITE_MB=$VITE_UPLOAD_LIMITE_MB

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── 2. Build da API ──────────────────────────────────────────────────────────
FROM node:24-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# ─── 3. Imagem final, só com o necessário para rodar ──────────────────────────
FROM node:24-alpine
ENV NODE_ENV=production \
    PORTA=3000 \
    FRONTEND_DIST=/app/frontend/dist \
    UPLOAD_DIR=/app/uploads
WORKDIR /app/backend

COPY --from=backend /app/backend/package.json ./package.json
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/drizzle ./drizzle
COPY --from=backend /app/backend/seed ./seed
COPY --from=backend /app/backend/openapi.yaml ./openapi.yaml
COPY --from=frontend /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/saude > /dev/null || exit 1

# Aplica migrações, garante o administrador inicial (e os exemplos, se
# SEED_EXEMPLOS=true), gera as capas que faltam e sobe o servidor.
CMD ["sh", "-c", "node dist/db/migrar.js && node dist/db/seed.js && node dist/db/gerar-capas.js && node dist/server.js"]
