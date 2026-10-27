import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alterarStatusUsuario } from '../../api/admin';
import type { StatusUsuario, Usuario } from '../../api/tipos';
import { mensagemDeErro } from '../../componentes/Estados';
import { useNotificar } from '../../contexto/Notificacoes';

/**
 * Depois de qualquer alteração feita pelo admin, recarregamos as consultas:
 * listas, painel e as telas do portal podem ter mudado.
 */
export function useRecarregarTudo() {
  const clienteQuery = useQueryClient();
  return () => clienteQuery.invalidateQueries();
}

const MENSAGENS: Record<StatusUsuario, (nome: string) => string> = {
  ATIVO: (nome) => `Acesso de ${nome} liberado.`,
  INATIVO: (nome) => `${nome} não tem mais acesso ao portal.`,
  PENDENTE: (nome) => `${nome} voltou para a fila de aprovação.`,
};

/** Aprovar, recusar ou desativar um usuário (usado no painel e na lista). */
export function useAlterarStatus() {
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();

  return useMutation({
    mutationFn: ({ usuario, status }: { usuario: Usuario; status: StatusUsuario }) =>
      alterarStatusUsuario(usuario.id, status),
    onSuccess: (atualizado, { status }) => {
      notificar(MENSAGENS[status](atualizado.nome));
      void recarregar();
    },
    onError: (erro) => notificar(mensagemDeErro(erro), 'erro'),
  });
}
