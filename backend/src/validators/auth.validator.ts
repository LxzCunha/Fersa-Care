import { z } from 'zod';
import { campoEmail, campoSenhaNova, textoOpcional } from '../lib/validacao.js';

export const esquemaEntrar = z.object({
  email: campoEmail,
  senha: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.'),
});

export const esquemaSolicitarAcesso = z.object({
  nome: z.string({ error: 'Informe seu nome.' }).trim().min(3, 'Informe seu nome completo.').max(120),
  email: campoEmail,
  senha: campoSenhaNova,
  empresa: textoOpcional(160),
  telefone: textoOpcional(30),
});

export const esquemaAtualizarPerfil = z.object({
  nome: z.string({ error: 'Informe seu nome.' }).trim().min(3, 'Informe seu nome completo.').max(120),
  empresa: textoOpcional(160),
  telefone: textoOpcional(30),
});

export const esquemaTrocarSenha = z.object({
  senhaAtual: z.string({ error: 'Informe a senha atual.' }).min(1, 'Informe a senha atual.'),
  novaSenha: campoSenhaNova,
});

export type DadosSolicitarAcesso = z.infer<typeof esquemaSolicitarAcesso>;
export type DadosAtualizarPerfil = z.infer<typeof esquemaAtualizarPerfil>;
export type DadosTrocarSenha = z.infer<typeof esquemaTrocarSenha>;
