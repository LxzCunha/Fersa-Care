import { Router } from 'express';
import * as saudeController from '../controllers/saude.controller.js';
import { adminRotas } from './admin.routes.js';
import { assistenteRotas } from './assistente.routes.js';
import { authRotas } from './auth.routes.js';
import { categoriasRotas } from './categorias.routes.js';
import { documentosRotas } from './documentos.routes.js';
import { produtosRotas } from './produtos.routes.js';

/**
 * Todas as rotas da API, montadas em /api pelo app.ts.
 *
 * Cada requisição atravessa as camadas nesta ordem:
 *   routes → controllers → services → repositories → banco (models)
 * Os arquivos *.routes.ts só ligam método + caminho + middlewares a uma
 * função do controller; não há lógica aqui.
 */
export const rotasDaApi = Router();

rotasDaApi.get('/saude', saudeController.vivo);
rotasDaApi.get('/saude/pronto', saudeController.pronto);

rotasDaApi.use('/auth', authRotas);
rotasDaApi.use('/documentos', documentosRotas);
rotasDaApi.use('/produtos', produtosRotas);
rotasDaApi.use('/categorias', categoriasRotas);
rotasDaApi.use('/assistente', assistenteRotas);
rotasDaApi.use('/admin', adminRotas);
