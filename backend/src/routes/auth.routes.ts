import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { exigirLogin } from '../middlewares/autenticacao.js';
import { limiteDeCadastro, limiteDeLogin } from '../middlewares/limites.js';

/** Login e conta: /api/auth/... */
export const authRotas = Router();

authRotas.post('/entrar', limiteDeLogin, authController.entrar);
authRotas.post('/sair', authController.sair);
authRotas.post('/solicitar-acesso', limiteDeCadastro, authController.solicitarAcesso);

authRotas.get('/eu', authController.eu);
authRotas.put('/eu', exigirLogin, authController.atualizarPerfil);
authRotas.put('/eu/senha', exigirLogin, authController.trocarSenha);
