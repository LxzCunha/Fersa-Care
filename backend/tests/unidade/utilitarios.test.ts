import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { caminhoDoArquivo, extensaoDe, gerarChave, tipoDoArquivo } from '../../src/lib/armazenamento.js';
import { temCapaAutomatica } from '../../src/lib/capas.js';
import { conflito, ErroHttp, naoAutenticado, naoEncontrado, proibido, requisicaoInvalida } from '../../src/lib/erros.js';
import { escaparLike, montarPagina, somenteLetrasENumeros, termosDaBusca } from '../../src/lib/validacao.js';

describe('Busca', () => {
  it('escapa % e _ para não virarem curinga no ILIKE', () => {
    expect(escaparLike('100%_algodão')).toBe('100\\%\\_algodão');
    expect(escaparLike('c:\\pasta')).toBe('c:\\\\pasta');
  });

  it('divide a busca em até 6 termos, ignorando espaços extras', () => {
    expect(termosDaBusca('  rolamento   de  roda ')).toEqual(['rolamento', 'de', 'roda']);
    expect(termosDaBusca('a b c d e f g h')).toHaveLength(6);
    expect(termosDaBusca('   ')).toEqual([]);
  });

  it('códigos são comparados só com letras e números', () => {
    expect(somenteLetrasENumeros('32008 X')).toBe('32008X');
    expect(somenteLetrasENumeros('F-15.052')).toBe('F15052');
    expect(somenteLetrasENumeros('UCP 205/25 (Ç)')).toBe('UCP20525Ç');
  });
});

describe('Paginação', () => {
  it('calcula o total de páginas, com pelo menos 1', () => {
    expect(montarPagina(['a'], 45, 3, 20)).toEqual({ itens: ['a'], total: 45, pagina: 3, porPagina: 20, totalPaginas: 3 });
    expect(montarPagina([], 0, 1, 20).totalPaginas).toBe(1);
    expect(montarPagina([], 40, 1, 20).totalPaginas).toBe(2);
  });
});

describe('Armazenamento de arquivos', () => {
  it('extensão em minúsculas', () => {
    expect(extensaoDe('Manual.PDF')).toBe('.pdf');
    expect(extensaoDe('sem-extensao')).toBe('');
  });

  it('tipos permitidos: mime e se abre no navegador', () => {
    expect(tipoDoArquivo('guia.pdf')).toEqual({ mime: 'application/pdf', exibirNoNavegador: true });
    expect(tipoDoArquivo('planilha.csv')?.exibirNoNavegador).toBe(false);
    expect(tipoDoArquivo('programa.exe')).toBeUndefined();
    expect(tipoDoArquivo('pagina.html')).toBeUndefined();
  });

  it('chave gerada é aleatória e mantém a extensão', () => {
    const chave = gerarChave('Manual de montagem.PDF');
    expect(chave).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(gerarChave('a.pdf')).not.toBe(gerarChave('a.pdf'));
  });

  it('nenhuma chave aponta para fora da pasta de uploads', () => {
    expect(caminhoDoArquivo('../../etc/passwd')).toBe(path.join(env.UPLOAD_DIR, 'passwd'));
    expect(path.dirname(caminhoDoArquivo('/absoluto/arquivo.pdf'))).toBe(path.resolve(env.UPLOAD_DIR));
  });

  it('capa automática só para PDF e imagens', () => {
    for (const nome of ['a.pdf', 'b.PNG', 'c.jpg', 'd.jpeg', 'e.webp']) expect(temCapaAutomatica(nome)).toBe(true);
    for (const nome of ['f.mp4', 'g.docx', 'h.zip', 'i.txt']) expect(temCapaAutomatica(nome)).toBe(false);
  });
});

describe('Erros HTTP', () => {
  it.each([
    [requisicaoInvalida('x'), 400, 'DADOS_INVALIDOS'],
    [naoAutenticado(), 401, 'NAO_AUTENTICADO'],
    [proibido(), 403, 'PROIBIDO'],
    [naoEncontrado(), 404, 'NAO_ENCONTRADO'],
    [conflito('x'), 409, 'CONFLITO'],
  ])('%s → %i %s', (erro, status, codigo) => {
    expect(erro).toBeInstanceOf(ErroHttp);
    expect(erro).toMatchObject({ status, codigo });
  });

  it('carrega os detalhes por campo', () => {
    expect(requisicaoInvalida('Confira', [{ campo: 'nome', mensagem: 'curto' }]).detalhes).toEqual([
      { campo: 'nome', mensagem: 'curto' },
    ]);
  });
});
