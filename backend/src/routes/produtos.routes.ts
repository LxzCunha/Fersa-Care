import { Router } from 'express';
import * as produtosController from '../controllers/produtos.controller.js';

export const produtosRotas = Router();

produtosRotas.get('/', produtosController.listar);
produtosRotas.get('/:id', produtosController.detalhar);
produtosRotas.get('/:id/imagem', produtosController.imagem);
