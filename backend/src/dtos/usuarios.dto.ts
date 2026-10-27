import type { Usuario } from '../models/index.js';

/** Nunca devolve o hash da senha. */
export function paraUsuarioDto(usuario: Usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    empresa: usuario.empresa,
    telefone: usuario.telefone,
    perfil: usuario.perfil,
    status: usuario.status,
    ultimoAcessoEm: usuario.ultimoAcessoEm,
    criadoEm: usuario.criadoEm,
    atualizadoEm: usuario.atualizadoEm,
  };
}

export type UsuarioDto = ReturnType<typeof paraUsuarioDto>;
