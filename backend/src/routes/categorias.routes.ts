import { Router } from 'express';
import * as categoriasController from '../controllers/categorias.controller.js';

export const categoriasRotas = Router();

categoriasRotas.get('/', categoriasController.listar);
