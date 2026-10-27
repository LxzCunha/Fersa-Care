import { describe, expect, it } from 'vitest';
import { descreverDetalhes, destinoDoAlvo, sobreAPropriaConta } from '../../src/lib/auditoria';
import { umEventoDeAuditoria } from '../fabricas';

describe('Detalhes de um evento da auditoria', () => {
  const descrever = (detalhes: Record<string, unknown>) => descreverDetalhes({ detalhes });

  it('campos alterados em português', () => {
    expect(descrever({ campos: ['titulo', 'visibilidade', 'arquivo'] })).toEqual(['Alterou: título, visibilidade, arquivo']);
    expect(descrever({ campos: ['diametroInternoMm', 'categoriaId', 'imagem'] })).toEqual([
      'Alterou: Ø interno, categoria, foto',
    ]);
    expect(descrever({ campos: ['campoNovoDaApi'] })).toEqual(['Alterou: campoNovoDaApi']);
  });

  it('salvar sem mudar nada também aparece', () => {
    expect(descrever({ campos: [] })).toEqual(['Salvo sem mudanças']);
  });

  it('situação e perfil com de → para (o campo não se repete na lista)', () => {
    expect(
      descrever({
        campos: ['empresa', 'status', 'perfil'],
        status: { de: 'ATIVO', para: 'INATIVO' },
        perfil: { de: 'USUARIO', para: 'ADMIN' },
      }),
    ).toEqual(['Alterou: empresa', 'Situação: Ativo → Inativo', 'Perfil: Cliente → Administrador']);
    expect(descrever({ campos: ['status'], status: { de: 'ABERTO', para: 'RESOLVIDO' } })).toEqual([
      'Situação: Aberto → Resolvido',
    ]);
  });

  it('login recusado: motivo e e-mail digitado', () => {
    expect(descrever({ email: 'carlos@oficina.com', motivo: 'CREDENCIAIS_INVALIDAS' })).toEqual([
      'Motivo: e-mail ou senha errados',
      'E-mail digitado: carlos@oficina.com',
    ]);
    expect(descrever({ motivo: 'CONTA_INATIVA' })).toEqual(['Motivo: conta desativada']);
  });

  it('com a conta identificada, o e-mail digitado não se repete', () => {
    const alvo = { tipo: 'USUARIO' as const, id: 'u-1', rotulo: 'Carlos <carlos@oficina.com>' };
    expect(descreverDetalhes({ alvo, detalhes: { email: 'carlos@oficina.com', motivo: 'CREDENCIAIS_INVALIDAS' } })).toEqual([
      'Motivo: e-mail ou senha errados',
    ]);
  });

  it('documento restrito: visibilidade no cadastro e quem ganhou ou perdeu acesso', () => {
    expect(descrever({ visibilidade: 'RESTRITO', publicado: true, acessoLiberadoPara: ['a', 'b'] })).toEqual([
      'Visibilidade: Usuários específicos',
      'Acesso liberado para 2 pessoas',
    ]);
    expect(descrever({ campos: ['titulo'], acessoRetiradoDe: ['a'] })).toEqual([
      'Alterou: título',
      'Acesso retirado de 1 pessoa',
    ]);
  });

  it('detalhes vazios ou de formato inesperado não quebram', () => {
    expect(descrever({})).toEqual([]);
    expect(descrever({ campos: 'titulo', status: 'ATIVO', acessoLiberadoPara: 3 })).toEqual([]);
  });
});

describe('Link para o registro afetado', () => {
  it('ação sobre a própria conta (login, troca de senha)', () => {
    const carlos = { id: 'u-1', nome: 'Carlos' };
    const alvo = { tipo: 'USUARIO' as const, id: 'u-1', rotulo: 'Carlos <c@x.com>' };
    expect(sobreAPropriaConta(umEventoDeAuditoria({ acao: 'LOGIN', autor: carlos, alvo }))).toBe(true);
    expect(sobreAPropriaConta(umEventoDeAuditoria({ acao: 'USUARIO_ALTERADO', alvo }))).toBe(false);
    expect(sobreAPropriaConta(umEventoDeAuditoria({ acao: 'LOGIN_RECUSADO', autor: null, alvo }))).toBe(false);
  });

  it('abre a janela do registro no admin', () => {
    expect(destinoDoAlvo(umEventoDeAuditoria())).toBe('/admin/documentos/doc-1');
    expect(
      destinoDoAlvo(umEventoDeAuditoria({ acao: 'LOGIN', alvo: { tipo: 'USUARIO', id: 'u-1', rotulo: 'Carlos' } })),
    ).toBe('/admin/usuarios/u-1');
    expect(
      destinoDoAlvo(umEventoDeAuditoria({ acao: 'PRODUTO_CRIADO', alvo: { tipo: 'PRODUTO', id: 'p-1', rotulo: '30205' } })),
    ).toBe('/admin/produtos/p-1');
  });

  it('registro excluído ou evento sem alvo: sem link', () => {
    expect(destinoDoAlvo(umEventoDeAuditoria({ acao: 'DOCUMENTO_EXCLUIDO' }))).toBeUndefined();
    expect(destinoDoAlvo(umEventoDeAuditoria({ acao: 'LOGIN_RECUSADO', alvo: null }))).toBeUndefined();
  });
});
