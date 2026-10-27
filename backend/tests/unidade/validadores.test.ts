import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { esquemaSolicitarAcesso } from '../../src/validators/auth.validator.js';
import { esquemaCategoria } from '../../src/validators/categorias.validator.js';
import { esquemaDocumento, esquemaFiltrosDocumentosAdmin } from '../../src/validators/documentos.validator.js';
import { esquemaFiltrosProdutosAdmin, esquemaProduto } from '../../src/validators/produtos.validator.js';
import { esquemaAtualizarUsuario, esquemaCriarUsuario } from '../../src/validators/usuarios.validator.js';

/** Mensagens de erro por campo, como a API devolve em `detalhes`. */
function errosDe(esquema: z.ZodType, dados: unknown): Record<string, string> {
  const resultado = esquema.safeParse(dados);
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join('.'), problema.message]));
}

const UUID = '3f1c2a9e-8b7d-4c6e-9f00-123456789abc';

describe('Peça (esquemaProduto)', () => {
  const valido = { codigo: ' 32008 x ', nome: 'Rolamento de rolos cônicos', segmento: 'PESADA' };

  it('aceita o mínimo e preenche o resto: código em maiúsculas, medidas e textos nulos, ativa', () => {
    expect(esquemaProduto.parse(valido)).toEqual({
      codigo: '32008 X',
      nome: 'Rolamento de rolos cônicos',
      segmento: 'PESADA',
      categoriaId: null,
      descricao: null,
      aplicacoes: null,
      diametroInternoMm: null,
      diametroExternoMm: null,
      larguraMm: null,
      pesoKg: null,
      ativo: true,
      removerImagem: false,
    });
  });

  it('textos opcionais vazios ou só com espaços viram null', () => {
    const dados = esquemaProduto.parse({ ...valido, descricao: '   ', aplicacoes: '  Cubo de roda  ' });
    expect(dados.descricao).toBeNull();
    expect(dados.aplicacoes).toBe('Cubo de roda');
  });

  it.each([
    [{ codigo: 'X' }, 'codigo', 'Informe o código da peça.'],
    [{ codigo: 'A'.repeat(41) }, 'codigo', 'Use no máximo 40 caracteres no código.'],
    [{ nome: 'ab' }, 'nome', 'Informe o nome do produto.'],
    [{ segmento: 'NAUTICO' }, 'segmento', 'Escolha o segmento.'],
    [{ categoriaId: 'nao-e-uuid' }, 'categoriaId', 'Categoria inválida.'],
    [{ diametroInternoMm: 0 }, 'diametroInternoMm', 'Ø interno: informe um valor maior que zero.'],
    [{ larguraMm: -2 }, 'larguraMm', 'Largura: informe um valor maior que zero.'],
    [{ pesoKg: 100_001 }, 'pesoKg', 'Peso: valor alto demais.'],
    [{ diametroExternoMm: '52' }, 'diametroExternoMm', 'Ø externo: informe um número.'],
  ])('recusa %o no campo %s', (alteracao, campo, mensagem) => {
    expect(errosDe(esquemaProduto, { ...valido, ...alteracao })[campo]).toBe(mensagem);
  });

  it('medidas válidas passam como número; null continua null', () => {
    const dados = esquemaProduto.parse({ ...valido, diametroInternoMm: 25.4, larguraMm: null, categoriaId: UUID });
    expect(dados).toMatchObject({ diametroInternoMm: 25.4, larguraMm: null, categoriaId: UUID });
  });

  it('sem nada: aponta código, nome e segmento', () => {
    expect(Object.keys(errosDe(esquemaProduto, {})).sort()).toEqual(['codigo', 'nome', 'segmento']);
  });
});

describe('Filtros do catálogo (esquemaFiltrosProdutosAdmin)', () => {
  it('converte os textos da URL e ignora filtros vazios', () => {
    expect(
      esquemaFiltrosProdutosAdmin.parse({ internoMin: '20.5', externoMax: '', ativo: 'false', pagina: '2', segmento: '' }),
    ).toEqual({ internoMin: 20.5, ativo: false, pagina: 2, porPagina: 20 });
  });

  it('página começa em 1 e no máximo 100 por página', () => {
    expect(errosDe(esquemaFiltrosProdutosAdmin, { pagina: '0' })).toHaveProperty('pagina');
    expect(errosDe(esquemaFiltrosProdutosAdmin, { porPagina: '101' })).toHaveProperty('porPagina');
  });

  it('medida negativa ou texto no filtro é recusado', () => {
    expect(errosDe(esquemaFiltrosProdutosAdmin, { larguraMin: '-1' })).toHaveProperty('larguraMin');
    expect(errosDe(esquemaFiltrosProdutosAdmin, { larguraMin: 'abc' })).toHaveProperty('larguraMin');
  });
});

describe('Categoria (esquemaCategoria)', () => {
  it('limpa espaços e descrição vazia vira null', () => {
    expect(esquemaCategoria.parse({ nome: '  Rolamentos de Esferas ', descricao: '' })).toEqual({
      nome: 'Rolamentos de Esferas',
      descricao: null,
    });
  });

  it.each([
    [{}, 'Informe o nome.'],
    [{ nome: 'ab' }, 'Informe o nome da categoria.'],
    [{ nome: '   abc   '.replace('abc', 'a') }, 'Informe o nome da categoria.'],
    [{ nome: 'x'.repeat(121) }, 'Use no máximo 120 caracteres no nome.'],
  ])('recusa %o: %s', (dados, mensagem) => {
    expect(errosDe(esquemaCategoria, dados).nome).toBe(mensagem);
  });

  it('descrição com mais de 2000 caracteres', () => {
    expect(errosDe(esquemaCategoria, { nome: 'Válida', descricao: 'x'.repeat(2001) }).descricao).toBe('Use no máximo 2000 caracteres.');
  });
});

describe('Documento (esquemaDocumento)', () => {
  const comArquivo = { titulo: 'Guia de montagem', tipo: 'MANUAL', visibilidade: 'PUBLICO', origem: 'ARQUIVO' };

  it('preenche idioma, publicado, listas vazias e removerCapa', () => {
    expect(esquemaDocumento.parse(comArquivo)).toEqual({
      ...comArquivo,
      descricao: null,
      idioma: 'pt-BR',
      publicado: true,
      produtoIds: [],
      usuarioIds: [],
      removerCapa: false,
    });
  });

  it('link exige o endereço, apontando o campo', () => {
    expect(errosDe(esquemaDocumento, { ...comArquivo, origem: 'LINK' })).toEqual({ urlExterna: 'Informe o link do conteúdo.' });
  });

  it('link só com http ou https', () => {
    expect(errosDe(esquemaDocumento, { ...comArquivo, origem: 'LINK', urlExterna: 'javascript:alert(1)' }).urlExterna).toBe(
      'Informe um link que comece com http:// ou https://.',
    );
    expect(esquemaDocumento.parse({ ...comArquivo, origem: 'LINK', urlExterna: 'https://youtu.be/abc' }).urlExterna).toBe(
      'https://youtu.be/abc',
    );
  });

  it.each([
    [{ titulo: 'ab' }, 'titulo', 'O título precisa ter pelo menos 3 caracteres.'],
    [{ titulo: 'x'.repeat(201) }, 'titulo', 'Use no máximo 200 caracteres no título.'],
    [{ tipo: 'APOSTILA' }, 'tipo', 'Escolha o tipo do documento.'],
    [{ visibilidade: 'TODOS' }, 'visibilidade', 'Escolha quem pode ver o documento.'],
    [{ origem: 'FTP' }, 'origem', 'Escolha entre enviar um arquivo ou usar um link.'],
    [{ idioma: 'fr' }, 'idioma', 'Idioma inválido.'],
    [{ produtoIds: ['nao-e-uuid'] }, 'produtoIds.0', 'Produto inválido.'],
    [{ usuarioIds: ['x'] }, 'usuarioIds.0', 'Usuário inválido.'],
  ])('recusa %o no campo %s', (alteracao, campo, mensagem) => {
    expect(errosDe(esquemaDocumento, { ...comArquivo, ...alteracao })[campo]).toBe(mensagem);
  });

  it('filtros do admin: situação vem como texto na URL', () => {
    expect(esquemaFiltrosDocumentosAdmin.parse({ publicado: 'false', tipo: 'VIDEO', visibilidade: '' })).toEqual({
      publicado: false,
      tipo: 'VIDEO',
      pagina: 1,
      porPagina: 20,
    });
  });
});

describe('Usuário (cadastro pelo admin e solicitação de acesso)', () => {
  const valido = { nome: 'Marina Costa', email: '  Marina@Exemplo.COM ', perfil: 'USUARIO', status: 'ATIVO', senha: 'Senha1234' };

  it('e-mail vira minúsculo e sem espaços; empresa vazia vira null', () => {
    expect(esquemaCriarUsuario.parse({ ...valido, empresa: '' })).toMatchObject({ email: 'marina@exemplo.com', empresa: null });
  });

  it.each([
    ['curta1', 'A senha precisa ter pelo menos 8 caracteres.'],
    ['somenteletras', 'A senha precisa ter pelo menos um número.'],
    ['12345678', 'A senha precisa ter pelo menos uma letra.'],
    ['a1'.repeat(37), 'A senha pode ter no máximo 72 caracteres.'],
  ])('senha "%s": %s', (senha, mensagem) => {
    expect(errosDe(esquemaCriarUsuario, { ...valido, senha }).senha).toBe(mensagem);
  });

  it('e-mail inválido e nome curto', () => {
    expect(errosDe(esquemaCriarUsuario, { ...valido, email: 'marina@', nome: 'Ma' })).toEqual({
      email: 'Informe um e-mail válido.',
      nome: 'Informe o nome completo.',
    });
  });

  it('na edição, a nova senha é opcional (vazia, null ou ausente), mas se vier precisa ser forte', () => {
    const { senha: _semSenha, ...semSenha } = valido;
    expect(esquemaAtualizarUsuario.safeParse(semSenha).success).toBe(true);
    expect(esquemaAtualizarUsuario.safeParse({ ...semSenha, novaSenha: '' }).success).toBe(true);
    expect(esquemaAtualizarUsuario.safeParse({ ...semSenha, novaSenha: null }).success).toBe(true);
    expect(esquemaAtualizarUsuario.safeParse({ ...semSenha, novaSenha: 'fraca' }).success).toBe(false);
  });

  it('a solicitação pública não tem campo de perfil (o que vier é ignorado)', () => {
    const dados = esquemaSolicitarAcesso.parse({ nome: 'Rafael Souza', email: 'r@x.com', senha: 'Senha1234', perfil: 'ADMIN' });
    expect(dados).not.toHaveProperty('perfil');
  });
});
