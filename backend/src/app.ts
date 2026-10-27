import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import swaggerUi, { type JsonObject } from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './config/env.js';
import { identificarUsuario } from './middlewares/autenticacao.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import { conferirOrigem } from './middlewares/origem.js';
import { identificarRequisicao, registrarRequisicao } from './middlewares/requisicao.js';
import { rotasDaApi } from './routes/index.js';

const ARQUIVO_OPENAPI = fileURLToPath(new URL('../openapi.yaml', import.meta.url));

export function criarApp() {
  const app = express();

  if (env.CONFIAR_PROXY > 0) app.set('trust proxy', env.CONFIAR_PROXY);
  app.disable('x-powered-by');

  app.use(identificarRequisicao);
  app.use(registrarRequisicao);

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
      strictTransportSecurity: env.COOKIE_SEGURO ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', conferirOrigem);
  app.use('/api', identificarUsuario);
  app.use('/api', rotasDaApi);

  if (fs.existsSync(ARQUIVO_OPENAPI)) {
    const especificacao = YAML.parse(fs.readFileSync(ARQUIVO_OPENAPI, 'utf8')) as JsonObject;
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
    app.get('/{*caminho}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(pastaDoSite, 'index.html'));
    });
  }

  app.use(tratarErros);
  return app;
}
