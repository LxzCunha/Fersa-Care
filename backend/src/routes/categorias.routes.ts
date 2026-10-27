import { Router } from 'express';
import * as categoriasController from '../controllers/categorias.controller.js';

/** Categorias do catálogo: /api/categorias */
export const categoriasRotas = Router();

categoriasRotas.get('/', categoriasController.listar);
