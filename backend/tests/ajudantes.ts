import fs from 'node:fs/promises';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { caminhoDoArquivo, gerarChave, tipoDoArquivo } from '../src/lib/armazenamento.js';
import { gerarHashSenha } from '../src/lib/senha.js';
import {
  categorias,
  documentoAcessos,
  documentoProdutos,
  documentos,
  produtos,
  usuarios,
  type Perfil,
  type Segmento,
  type StatusUsuario,
  type TipoDocumento,
  type Visibilidade,
} from '../src/models/index.js';

export const app = criarApp();
export const SENHA_PADRAO = 'Senha1234';

let contador = 0;
const proximo = () => ++contador;

export async function criarUsuario(
  dados: { perfil?: Perfil; status?: StatusUsuario; email?: string; nome?: string; senha?: string } = {},
) {
  const numero = proximo();
  const [usuario] = await db
    .insert(usuarios)
    .values({
      nome: dados.nome ?? `Pessoa ${numero}`,
      email: dados.email ?? `pessoa${numero}@teste.com`,
      senhaHash: await gerarHashSenha(dados.senha ?? SENHA_PADRAO),
      perfil: dados.perfil ?? 'USUARIO',
      status: dados.status ?? 'ATIVO',
    })
    .returning();
  return usuario!;
}

export const criarAdmin = () => criarUsuario({ perfil: 'ADMIN' });

export async function entrarComo(usuario: { email: string }, senha = SENHA_PADRAO) {
  const agente = request.agent(app);
  const resposta = await agente.post('/api/auth/entrar').send({ email: usuario.email, senha });
  if (resposta.status !== 200) {
    throw new Error(`Login falhou para ${usuario.email}: ${resposta.status} ${JSON.stringify(resposta.body)}`);
  }
  return agente;
}

export async function criarCategoria(nome?: string) {
  const [categoria] = await db
    .insert(categorias)
    .values({ nome: nome ?? `Categoria ${proximo()}` })
    .returning();
  return categoria!;
}

export async function criarProduto(
  dados: {
    codigo?: string;
    nome?: string;
    segmento?: Segmento;
    aplicacoes?: string;
    categoriaId?: string;
    ativo?: boolean;
    /** Ø interno × Ø externo × largura, em mm. */
    medidas?: [number, number, number];
  } = {},
) {
  const numero = proximo();
  const [produto] = await db
    .insert(produtos)
    .values({
      codigo: dados.codigo ?? `TST-${numero}`,
      nome: dados.nome ?? `Produto de teste ${numero}`,
      segmento: dados.segmento ?? 'LEVE',
      aplicacoes: dados.aplicacoes ?? null,
      categoriaId: dados.categoriaId ?? null,
      ativo: dados.ativo ?? true,
      diametroInternoMm: dados.medidas?.[0] ?? null,
      diametroExternoMm: dados.medidas?.[1] ?? null,
      larguraMm: dados.medidas?.[2] ?? null,
    })
    .returning();
  return produto!;
}

export async function criarDocumento(
  dados: {
    titulo?: string;
    descricao?: string;
    tipo?: TipoDocumento;
    visibilidade?: Visibilidade;
    publicado?: boolean;
    link?: string;
    liberadoPara?: string[];
    produtoIds?: string[];
    arquivo?: { nome: string; conteudo: string | Buffer };
  } = {},
) {
  const numero = proximo();
  let conteudo: Partial<typeof documentos.$inferInsert>;
  if (dados.link) {
    conteudo = { urlExterna: dados.link };
  } else {
    const nome = dados.arquivo?.nome ?? `documento-${numero}.pdf`;
    const bytes = dados.arquivo?.conteudo ?? `%PDF-1.4 conteúdo ${numero}`;
    const chave = gerarChave(nome);
    await fs.writeFile(caminhoDoArquivo(chave), bytes);
    conteudo = {
      arquivoChave: chave,
      arquivoNome: nome,
      arquivoMime: tipoDoArquivo(nome)?.mime ?? 'application/octet-stream',
      arquivoTamanho: Buffer.byteLength(bytes),
    };
  }

  const [documento] = await db
    .insert(documentos)
    .values({
      titulo: dados.titulo ?? `Documento ${numero}`,
      descricao: dados.descricao ?? null,
      tipo: dados.tipo ?? 'MANUAL',
      visibilidade: dados.visibilidade ?? 'PUBLICO',
      publicado: dados.publicado ?? true,
      ...conteudo,
    })
    .returning();

  if (dados.liberadoPara?.length) {
    await db
      .insert(documentoAcessos)
      .values(dados.liberadoPara.map((usuarioId) => ({ documentoId: documento!.id, usuarioId })));
  }
  if (dados.produtoIds?.length) {
    await db
      .insert(documentoProdutos)
      .values(dados.produtoIds.map((produtoId) => ({ documentoId: documento!.id, produtoId })));
  }
  return documento!;
}
