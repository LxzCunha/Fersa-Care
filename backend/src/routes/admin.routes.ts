import { Router } from 'express';
import * as auditoriaController from '../controllers/auditoria.controller.js';
import * as categoriasController from '../controllers/categorias.controller.js';
import * as chamadosController from '../controllers/chamados.controller.js';
import * as documentosAdminController from '../controllers/documentos-admin.controller.js';
import * as painelController from '../controllers/painel.controller.js';
import * as produtosController from '../controllers/produtos.controller.js';
import * as usuariosController from '../controllers/usuarios.controller.js';
import { exigirAdmin } from '../middlewares/autenticacao.js';
import { uploadDeDocumento, uploadDeImagem } from '../middlewares/upload.js';

/**
 * Área do administrador: /api/admin/...
 * Tudo aqui exige perfil ADMIN. Visitante recebe 401 (não autenticado) e
 * usuário comum recebe 403 (proibido).
 */
export const adminRotas = Router();

adminRotas.use(exigirAdmin);

adminRotas.get('/painel', painelController.obter);

adminRotas.get('/documentos', documentosAdminController.listar);
adminRotas.get('/documentos/:id', documentosAdminController.detalhar);
adminRotas.post('/documentos', uploadDeDocumento, documentosAdminController.criar);
adminRotas.put('/documentos/:id', uploadDeDocumento, documentosAdminController.atualizar);
adminRotas.delete('/documentos/:id', documentosAdminController.excluir);
adminRotas.post('/documentos/:id/indexar', documentosAdminController.reindexar);

adminRotas.get('/chamados', chamadosController.listar);
adminRotas.get('/chamados/:id', chamadosController.detalhar);
adminRotas.patch('/chamados/:id', chamadosController.atualizar);

adminRotas.get('/usuarios', usuariosController.listar);
adminRotas.get('/usuarios/:id', usuariosController.detalhar);
adminRotas.post('/usuarios', usuariosController.criar);
adminRotas.put('/usuarios/:id', usuariosController.atualizar);
adminRotas.patch('/usuarios/:id/status', usuariosController.alterarStatus);
adminRotas.delete('/usuarios/:id', usuariosController.excluir);

adminRotas.get('/produtos', produtosController.listarParaAdmin);
adminRotas.get('/produtos/:id', produtosController.detalharParaAdmin);
adminRotas.post('/produtos', uploadDeImagem, produtosController.criar);
adminRotas.put('/produtos/:id', uploadDeImagem, produtosController.atualizar);
adminRotas.delete('/produtos/:id', produtosController.excluir);

adminRotas.get('/categorias', categoriasController.listarParaAdmin);
adminRotas.get('/categorias/:id', categoriasController.detalhar);
adminRotas.post('/categorias', categoriasController.criar);
adminRotas.put('/categorias/:id', categoriasController.atualizar);
adminRotas.delete('/categorias/:id', categoriasController.excluir);

adminRotas.get('/auditoria', auditoriaController.listar);
