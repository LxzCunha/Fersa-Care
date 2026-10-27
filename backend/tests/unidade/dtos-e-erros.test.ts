import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { paraDocumentoDto } from '../../src/dtos/documentos.dto.js';
import { paraProdutoDto } from '../../src/dtos/produtos.dto.js';
import { paraUsuarioDto } from '../../src/dtos/usuarios.dto.js';
import { naoEncontrado } from '../../src/lib/erros.js';
import { log } from '../../src/lib/log.js';
import { tratarErros } from '../../src/middlewares/erros.js';
import type { LinhaDocumento, LinhaProduto, Usuario } from '../../src/models/index.js';

const DATA = new Date('2026-10-27T12:00:00.000Z');

function umDocumento(dados: Partial<LinhaDocumento> = {}): LinhaDocumento {
  return {
    id: 'd1',
    titulo: 'Guia',
    descricao: null,
    tipo: 'MANUAL',
    idioma: 'pt-BR',
    visibilidade: 'PUBLICO',
    publicado: true,
    arquivoChave: 'chave-secreta.pdf',
    arquivoNome: 'guia.pdf',
    arquivoMime: 'application/pdf',
    arquivoTamanho: 2048,
    urlExterna: null,
    capaChave: null,
    capaPersonalizada: false,
    indexadoEm: null,
    indexacaoErro: null,
    criadoPor: null,
    criadoEm: DATA,
    atualizadoEm: DATA,
    ...dados,
  };
}

describe('DTO do documento', () => {
  it('arquivo: origem, dados do arquivo, sem a chave interna do disco', () => {
    const dto = paraDocumentoDto(umDocumento(), []);
    expect(dto).toMatchObject({
      origem: 'ARQUIVO',
      arquivo: { nome: 'guia.pdf', mime: 'application/pdf', tamanho: 2048 },
      urlExterna: null,
      capaUrl: null,
      produtos: [],
    });
    expect(JSON.stringify(dto)).not.toContain('chave-secreta');
    expect(dto).not.toHaveProperty('arquivoChave');
    expect(dto).not.toHaveProperty('capaChave');
  });

  it('link: origem LINK e sem arquivo', () => {
    const dto = paraDocumentoDto(
      umDocumento({ arquivoChave: null, arquivoNome: null, arquivoMime: null, arquivoTamanho: null, urlExterna: 'https://youtu.be/x' }),
      [],
    );
    expect(dto).toMatchObject({ origem: 'LINK', arquivo: null, urlExterna: 'https://youtu.be/x' });
  });

  it('capa: endereço público com a versão da última edição, sem a chave', () => {
    const dto = paraDocumentoDto(umDocumento({ capaChave: 'capa-secreta.webp', capaPersonalizada: true }), []);
    expect(dto.capaUrl).toBe(`/api/documentos/d1/capa?v=${DATA.getTime()}`);
    expect(dto.capaPersonalizada).toBe(true);
    expect(JSON.stringify(dto)).not.toContain('capa-secreta');
  });

  it('leva as peças relacionadas recebidas', () => {
    const produtos = [{ id: 'p1', codigo: '30205', nome: 'Rolamento', segmento: 'LEVE' as const }];
    expect(paraDocumentoDto(umDocumento(), produtos).produtos).toEqual(produtos);
  });
});

describe('DTO da peça', () => {
  const linha: LinhaProduto = {
    id: 'p1',
    codigo: '30205',
    nome: 'Rolamento de rolos cônicos',
    segmento: 'LEVE',
    categoriaId: 'c1',
    categoria: { id: 'c1', nome: 'Rolamentos de Roletes Cônicos' },
    descricao: null,
    aplicacoes: 'Cubo de roda',
    diametroInternoMm: 25,
    diametroExternoMm: 52,
    larguraMm: 16.25,
    pesoKg: 0.16,
    imagemChave: 'foto-secreta.png',
    ativo: true,
    criadoEm: DATA,
    atualizadoEm: DATA,
  };

  it('foto por endereço público com versão; sem a chave nem o categoriaId solto', () => {
    const dto = paraProdutoDto(linha);
    expect(dto.imagemUrl).toBe(`/api/produtos/p1/imagem?v=${DATA.getTime()}`);
    expect(dto.categoria).toEqual({ id: 'c1', nome: 'Rolamentos de Roletes Cônicos' });
    expect(dto).not.toHaveProperty('imagemChave');
    expect(dto).not.toHaveProperty('categoriaId');
    expect(JSON.stringify(dto)).not.toContain('foto-secreta');
  });

  it('sem foto: imagemUrl null; medidas como números', () => {
    const dto = paraProdutoDto({ ...linha, imagemChave: null });
    expect(dto.imagemUrl).toBeNull();
    expect(dto).toMatchObject({ diametroInternoMm: 25, larguraMm: 16.25, pesoKg: 0.16 });
  });
});

describe('DTO do usuário', () => {
  it('nunca devolve o hash da senha nem a versão da sessão', () => {
    const usuario: Usuario = {
      id: 'u1',
      nome: 'Carlos',
      email: 'c@x.com',
      senhaHash: '$2b$10$segredo',
      empresa: null,
      telefone: null,
      perfil: 'USUARIO',
      status: 'ATIVO',
      ultimoAcessoEm: null,
      versaoSessao: 3,
      criadoEm: DATA,
      atualizadoEm: DATA,
    };
    const dto = paraUsuarioDto(usuario);
    expect(dto).not.toHaveProperty('senhaHash');
    expect(dto).not.toHaveProperty('versaoSessao');
    expect(JSON.stringify(dto)).not.toContain('segredo');
    expect(dto).toMatchObject({ id: 'u1', perfil: 'USUARIO', status: 'ATIVO' });
  });
});

describe('Middleware de erros', () => {
  function responder(erro: unknown) {
    const res = { headersSent: false, status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    tratarErros(erro, {} as Request, res as unknown as Response, () => undefined);
    return { status: res.status.mock.calls[0]?.[0], corpo: res.json.mock.calls[0]?.[0] };
  }

  it('ErroHttp: status e código do próprio erro', () => {
    expect(responder(naoEncontrado('Documento não encontrado.'))).toEqual({
      status: 404,
      corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Documento não encontrado.' } },
    });
  });

  it('Zod: 400 com a lista de campos (caminho com ponto) e a primeira mensagem', () => {
    const resultado = z
      .object({ nome: z.string().min(3, 'Nome curto.'), produtoIds: z.array(z.uuid('Produto inválido.')) })
      .safeParse({ nome: 'a', produtoIds: ['x'] });
    const { status, corpo } = responder(resultado.error);
    expect(status).toBe(400);
    expect(corpo.erro).toEqual({
      codigo: 'DADOS_INVALIDOS',
      mensagem: 'Nome curto.',
      detalhes: [
        { campo: 'nome', mensagem: 'Nome curto.' },
        { campo: 'produtoIds.0', mensagem: 'Produto inválido.' },
      ],
    });
  });

  it.each([
    ['usuarios_email_unico', 'Já existe um cadastro com este e-mail.'],
    ['produtos_codigo_unico', 'Já existe um produto com este código.'],
    ['categorias_nome_unico', 'Já existe uma categoria com este nome.'],
    ['outra_restricao', 'Registro duplicado.'],
  ])('PostgreSQL 23505 (%s) → 409 "%s", inclusive embrulhado pelo Drizzle', (constraint, mensagem) => {
    const doPostgres = { code: '23505', constraint };
    expect(responder(doPostgres)).toEqual({ status: 409, corpo: { erro: { codigo: 'CONFLITO', mensagem } } });
    expect(responder(Object.assign(new Error('falhou'), { cause: doPostgres })).status).toBe(409);
  });

  it('PostgreSQL 23503 (referência) e 22P02 (formato) → 400', () => {
    expect(responder({ code: '23503' }).corpo.erro.codigo).toBe('REFERENCIA_INVALIDA');
    expect(responder({ code: '22P02' }).corpo.erro.mensagem).toBe('Identificador em formato inválido.');
  });

  it('JSON malformado e corpo grande demais', () => {
    expect(responder({ type: 'entity.parse.failed' })).toMatchObject({ status: 400, corpo: { erro: { codigo: 'JSON_INVALIDO' } } });
    expect(responder({ type: 'entity.too.large' })).toMatchObject({ status: 413 });
  });

  it('erro inesperado: 500 genérico, sem vazar detalhes (que vão só para o log)', () => {
    const espiao = vi.spyOn(log, 'error').mockImplementation(() => undefined);
    const falha = new Error('senha do banco: hunter2');
    const { status, corpo } = responder(falha);
    expect(status).toBe(500);
    expect(JSON.stringify(corpo)).not.toContain('hunter2');
    expect(espiao).toHaveBeenCalledWith({ err: falha }, 'Erro inesperado');
    espiao.mockRestore();
  });
});
