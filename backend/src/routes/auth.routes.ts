import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { exigirLogin } from '../middlewares/autenticacao.js';
import { limiteDeCadastro, limiteDeLogin, limiteDeLoginPorConta } from '../middlewares/limites.js';

export const authRotas = Router();

authRotas.post('/entrar', limiteDeLogin, limiteDeLoginPorConta, authController.entrar);
authRotas.post('/sair', authController.sair);
authRotas.post('/solicitar-acesso', limiteDeCadastro, authController.solicitarAcesso);

authRotas.get('/eu', authController.eu);
authRotas.put('/eu', exigirLogin, authController.atualizarPerfil);
authRotas.put('/eu/senha', exigirLogin, authController.trocarSenha);
authRotas.post('/eu/encerrar-outras-sessoes', exigirLogin, authController.encerrarOutrasSessoes);
