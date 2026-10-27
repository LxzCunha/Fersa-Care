import { z } from 'zod';
import {
  campoEmail,
  campoSenhaNova,
  esquemaPaginacao,
  opcionalNaUrl,
  textoOpcional,
} from '../lib/validacao.js';
import { perfilUsuario, statusUsuario } from '../models/index.js';

export const esquemaFiltrosUsuarios = esquemaPaginacao.extend({
  busca: opcionalNaUrl(z.string().trim().max(120)),
  status: opcionalNaUrl(z.enum(statusUsuario.enumValues)),
  perfil: opcionalNaUrl(z.enum(perfilUsuario.enumValues)),
});

export type FiltrosUsuarios = z.infer<typeof esquemaFiltrosUsuarios>;

const camposComuns = {
  nome: z.string({ error: 'Informe o nome.' }).trim().min(3, 'Informe o nome completo.').max(120),
  email: campoEmail,
  empresa: textoOpcional(160),
  telefone: textoOpcional(30),
  perfil: z.enum(perfilUsuario.enumValues, { error: 'Escolha o perfil.' }),
  status: z.enum(statusUsuario.enumValues, { error: 'Escolha a situação.' }),
};

/** Usuário cadastrado pelo administrador (já pode nascer ATIVO). */
export const esquemaCriarUsuario = z.object({
  ...camposComuns,
  senha: campoSenhaNova,
});

/** Edição: a senha só muda se `novaSenha` vier preenchida. */
export const esquemaAtualizarUsuario = z.object({
  ...camposComuns,
  novaSenha: z.union([campoSenhaNova, z.literal(''), z.null()]).optional(),
});

export const esquemaAlterarStatus = z.object({
  status: z.enum(statusUsuario.enumValues, { error: 'Situação inválida.' }),
});

export type DadosCriarUsuario = z.infer<typeof esquemaCriarUsuario>;
export type DadosAtualizarUsuario = z.infer<typeof esquemaAtualizarUsuario>;
