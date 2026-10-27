FROM node:24-alpine AS frontend
WORKDIR /app/frontend

# Variáveis VITE_ são fixadas no build do site.
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

FROM node:24-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
LABEL org.opencontainers.image.title="FERSA CARE" \
      org.opencontainers.image.description="Portal de pós-venda FERSA: API Node.js que também entrega o site React" \
      org.opencontainers.image.authors="Alexandre Breus da Cunha" \
      org.opencontainers.image.source="https://github.com/LxzCunha/Fersa-Care"
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
  CMD wget -qO- http://127.0.0.1:3000/api/saude/pronto > /dev/null || exit 1

CMD ["sh", "-c", "node dist/db/migrar.js && node dist/db/seed.js && node dist/db/gerar-capas.js && node dist/server.js"]
