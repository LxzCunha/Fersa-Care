import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './config/env.js';
import { identificarUsuario } from './middlewares/autenticacao.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import { rotasDaApi } from './routes/index.js';

const ARQUIVO_OPENAPI = fileURLToPath(new URL('../openapi.yaml', import.meta.url));

/**
 * Monta a aplicação Express. Fica separado do server.ts para os testes
 * conseguirem usar a API sem abrir uma porta de rede.
 */
export function criarApp() {
  const app = express();

  if (env.CONFIAR_PROXY > 0) app.set('trust proxy', env.CONFIAR_PROXY);

  // Cabeçalhos de segurança (CSP, nosniff, frame-ancestors...).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
          mediaSrc: ["'self'", 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          // Vídeos incorporados (YouTube/Vimeo) e PDFs do próprio portal.
          frameSrc: [
            "'self'",
            'https://www.youtube-nocookie.com',
            'https://www.youtube.com',
            'https://player.vimeo.com',
          ],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          upgradeInsecureRequests: env.COOKIE_SEGURO ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // ── API ──────────────────────────────────────────────────────────────────
  app.use('/api', identificarUsuario);
  app.use('/api', rotasDaApi);

  // Documentação interativa da API (Swagger UI) em /api/docs
  if (fs.existsSync(ARQUIVO_OPENAPI)) {
    const especificacao = YAML.parse(fs.readFileSync(ARQUIVO_OPENAPI, 'utf8'));
    app.get('/api/docs/openapi.json', (_req, res) => {
      res.json(especificacao);
    });
    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(especificacao, {
        customSiteTitle: 'API FERSA CARE',
        swaggerOptions: { withCredentials: true, persistAuthorization: true },
      }),
    );
  }

  app.use('/api', rotaNaoEncontrada);

  // ── Front-end (produção) ────────────────────────────────────────────────
  // Com FRONTEND_DIST definido, a API também entrega o site React.
  if (env.FRONTEND_DIST && fs.existsSync(path.join(env.FRONTEND_DIST, 'index.html'))) {
    const pastaDoSite = env.FRONTEND_DIST;
    app.use(
      express.static(pastaDoSite, {
        index: false,
        setHeaders: (res, caminho) => {
          // Arquivos de /assets têm hash no nome: podem ficar em cache "para sempre".
          if (caminho.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    // Qualquer outra rota devolve o index.html e o React Router assume a navegação.
    app.get('/{*caminho}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(pastaDoSite, 'index.html'));
    });
  }

  app.use(tratarErros);
  return app;
}
