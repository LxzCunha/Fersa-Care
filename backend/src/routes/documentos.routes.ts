import { Router } from 'express';
import * as documentosController from '../controllers/documentos.controller.js';

/** Biblioteca pública: /api/documentos/... (cada um recebe só o que pode ver) */
export const documentosRotas = Router();

documentosRotas.get('/', documentosController.listar);
documentosRotas.get('/resumo', documentosController.resumo);
documentosRotas.get('/:id', documentosController.detalhar);
documentosRotas.get('/:id/arquivo', documentosController.baixarArquivo);
