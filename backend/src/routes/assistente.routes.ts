import { Router } from 'express';
import * as assistenteController from '../controllers/assistente.controller.js';
import { limiteDeChamados, limiteDoAssistente } from '../middlewares/limites.js';

export const assistenteRotas = Router();

assistenteRotas.post('/perguntas', limiteDoAssistente, assistenteController.perguntar);
assistenteRotas.get('/conversas/:id', assistenteController.conversa);
assistenteRotas.post('/chamados', limiteDeChamados, assistenteController.abrirChamado);
