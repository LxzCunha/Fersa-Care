import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { Usuario } from '../api/tipos';

/**
 * Guarda quem está logado e expõe entrar/sair para qualquer tela.
 * A fonte da verdade é a API (GET /api/auth/eu); aqui só mantemos em memória.
 */

interface ValorAutenticacao {
  usuario: Usuario | null;
  carregando: boolean;
  ehAdmin: boolean;
  entrar: (email: string, senha: string) => Promise<Usuario>;
  sair: () => Promise<void>;
  atualizarUsuario: (usuario: Usuario) => void;
}

const ContextoAutenticacao = createContext<ValorAutenticacao | null>(null);

export const CHAVE_USUARIO_ATUAL = ['usuario-atual'] as const;

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const clienteQuery = useQueryClient();

  const { data: usuario = null, isPending } = useQuery({
    queryKey: CHAVE_USUARIO_ATUAL,
    queryFn: authApi.obterUsuarioAtual,
    staleTime: 5 * 60 * 1000,
  });

  /** Depois de entrar ou sair, tudo que foi carregado pode ter mudado de permissão. */
  const descartarDadosDeOutraSessao = useCallback(() => {
    clienteQuery.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== CHAVE_USUARIO_ATUAL[0] });
  }, [clienteQuery]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const logado = await authApi.entrar(email, senha);
      descartarDadosDeOutraSessao();
      clienteQuery.setQueryData(CHAVE_USUARIO_ATUAL, logado);
      return logado;
    },
    [clienteQuery, descartarDadosDeOutraSessao],
  );

  const sair = useCallback(async () => {
    await authApi.sair();
    descartarDadosDeOutraSessao();
    clienteQuery.setQueryData(CHAVE_USUARIO_ATUAL, null);
  }, [clienteQuery, descartarDadosDeOutraSessao]);

  const atualizarUsuario = useCallback(
    (atualizado: Usuario) => clienteQuery.setQueryData(CHAVE_USUARIO_ATUAL, atualizado),
    [clienteQuery],
  );

  const valor = useMemo<ValorAutenticacao>(
    () => ({
      usuario,
      carregando: isPending,
      ehAdmin: usuario?.perfil === 'ADMIN',
      entrar,
      sair,
      atualizarUsuario,
    }),
    [usuario, isPending, entrar, sair, atualizarUsuario],
  );

  return <ContextoAutenticacao value={valor}>{children}</ContextoAutenticacao>;
}

export function useAutenticacao(): ValorAutenticacao {
  const contexto = useContext(ContextoAutenticacao);
  if (!contexto) throw new Error('useAutenticacao precisa estar dentro de <ProvedorAutenticacao>.');
  return contexto;
}
