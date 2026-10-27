import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { count, eq } from 'drizzle-orm';
import { caminhoDoArquivo, garantirPastaDeUploads, gerarChave, tipoDoArquivo } from '../lib/armazenamento.js';
import { gerarCapa, temCapaAutomatica } from '../lib/capas.js';
import { gerarHashSenha } from '../lib/senha.js';
import { campoEmail, campoSenhaNova } from '../lib/validacao.js';
import {
  categorias,
  documentoAcessos,
  documentoProdutos,
  documentos,
  documentoVisualizacoes,
  produtos,
  usuarios,
  type Segmento,
  type TipoDocumento,
  type Visibilidade,
} from '../models/index.js';
import { db, pool } from './index.js';

// Idempotente: pode rodar várias vezes sem duplicar nada.
const PASTA_EXEMPLOS = fileURLToPath(new URL('../../seed/arquivos/', import.meta.url));
const SENHA_CLIENTES_EXEMPLO = 'Cliente@123';

async function garantirAdministrador() {
  const [existente] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.perfil, 'ADMIN'))
    .limit(1);
  if (existente) {
    console.log('• Já existe um administrador — nenhum novo foi criado.');
    return;
  }

  const email = campoEmail.parse(process.env.ADMIN_EMAIL ?? 'admin@fersacare.com.br');
  const senhaInformada = process.env.ADMIN_SENHA ?? 'Admin@123';
  const senha = campoSenhaNova.safeParse(senhaInformada);
  if (!senha.success) {
    throw new Error(`ADMIN_SENHA inválida: ${senha.error.issues[0]?.message}`);
  }

  await db.insert(usuarios).values({
    nome: process.env.ADMIN_NOME ?? 'Administrador FERSA CARE',
    email,
    senhaHash: await gerarHashSenha(senha.data),
    perfil: 'ADMIN',
    status: 'ATIVO',
  });
  console.log(`✅ Administrador criado: ${email}`);
  if (!process.env.ADMIN_SENHA) {
    console.log('   Senha padrão "Admin@123" — troque em "Minha conta" depois do primeiro acesso.');
  }
}

async function copiarArquivoDeExemplo(nome: string) {
  const chave = gerarChave(nome);
  await fs.copyFile(path.join(PASTA_EXEMPLOS, nome), caminhoDoArquivo(chave));
  const { size } = await fs.stat(caminhoDoArquivo(chave));
  return {
    arquivoChave: chave,
    arquivoNome: nome,
    arquivoMime: tipoDoArquivo(nome)?.mime ?? 'application/octet-stream',
    arquivoTamanho: size,
    capaChave: temCapaAutomatica(nome) ? await gerarCapa(chave, nome) : null,
  };
}

/** Semente fixa: o painel de exemplo sai sempre igual. */
function aleatorio(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

async function inserirExemplos() {
  const [jaExistem] = await db.select({ total: count() }).from(produtos);
  if ((jaExistem?.total ?? 0) > 0) {
    console.log('• O banco já tem produtos — dados de exemplo não foram inseridos.');
    return;
  }

  const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.perfil, 'ADMIN')).limit(1);
  const senhaHash = await gerarHashSenha(SENHA_CLIENTES_EXEMPLO);

  const clientes = await db
    .insert(usuarios)
    .values([
      {
        nome: 'Carlos Mendes',
        email: 'oficina@exemplo.com',
        empresa: 'Auto Center Exemplo',
        telefone: '(41) 99999-0001',
        senhaHash,
        perfil: 'USUARIO',
        status: 'ATIVO',
      },
      {
        nome: 'Juliana Prado',
        email: 'distribuidor@exemplo.com',
        empresa: 'Distribuidora Exemplo de Autopeças',
        telefone: '(41) 99999-0002',
        senhaHash,
        perfil: 'USUARIO',
        status: 'ATIVO',
      },
      {
        nome: 'Rafael Souza',
        email: 'pendente@exemplo.com',
        empresa: 'Mecânica Diesel Exemplo',
        telefone: '(41) 99999-0003',
        senhaHash,
        perfil: 'USUARIO',
        status: 'PENDENTE',
      },
    ])
    .returning({ id: usuarios.id, email: usuarios.email });
  const clientePorEmail = Object.fromEntries(clientes.map((c) => [c.email, c.id]));

  const nomesDasCategorias = [
    'Rolamentos de Esferas',
    'Rolamentos de Roletes Cônicos',
    'Rolamentos de Rolos Cilíndricos',
    'Rolamentos Autocompensadores de Rolos',
    'Rolamentos de Agulhas',
    'Rolamentos de embreagem',
    'Unidades de Rolamentos',
    'Kits de Roda para Turismo',
    'Unidades de Cubos de Roda para Veículos Pesados',
    'Kits de reparo EV',
    'Kits de reparo F-Box',
    'Engine driving system',
    'Componentes',
    'Módulo de Pinhão',
    'Atuador da Embreagem',
    'Produtos de Manutenção',
    'Ferramentas Fersa',
    'Outros',
  ];
  const categoriasCriadas = await db
    .insert(categorias)
    .values(nomesDasCategorias.map((nome) => ({ nome })))
    .returning({ id: categorias.id, nome: categorias.nome });
  const categoriaPorNome = Object.fromEntries(categoriasCriadas.map((c) => [c.nome, c.id]));

  // Medidas em mm e kg; kits sem medidas únicas ficam sem elas.
  const listaDeProdutos: {
    codigo: string;
    nome: string;
    segmento: Segmento;
    categoria: string;
    medidas: [interno: number, externo: number | null, largura: number | null, peso: number | null] | null;
    aplicacoes: string;
    descricao: string;
  }[] = [
    {
      codigo: '30205',
      nome: 'Rolamento de rolos cônicos',
      segmento: 'LEVE',
      categoria: 'Rolamentos de Roletes Cônicos',
      medidas: [25, 52, 16.25, 0.16],
      aplicacoes: 'Cubo de roda traseiro de automóveis e utilitários leves; diferenciais de pequeno porte.',
      descricao: 'Rolamento de uma carreira de rolos cônicos para cargas radiais e axiais combinadas.',
    },
    {
      codigo: '30206',
      nome: 'Rolamento de rolos cônicos',
      segmento: 'LEVE',
      categoria: 'Rolamentos de Roletes Cônicos',
      medidas: [30, 62, 17.25, 0.23],
      aplicacoes: 'Cubo de roda de utilitários e picapes; caixas de transferência.',
      descricao: 'Rolamento de uma carreira de rolos cônicos, série métrica.',
    },
    {
      codigo: '32008 X',
      nome: 'Rolamento de rolos cônicos',
      segmento: 'PESADA',
      categoria: 'Rolamentos de Roletes Cônicos',
      medidas: [40, 68, 19, 0.27],
      aplicacoes: 'Cubos de roda de caminhões médios; pinhão de diferencial.',
      descricao: 'Série X com geometria otimizada para maior capacidade de carga.',
    },
    {
      codigo: '02474/20',
      nome: 'Rolamento de rolos cônicos (polegada)',
      segmento: 'PESADA',
      categoria: 'Rolamentos de Roletes Cônicos',
      medidas: [28.58, 68.26, 22.23, 0.42],
      aplicacoes: 'Eixos de reboques e semirreboques; cubos de roda de ônibus.',
      descricao: 'Conjunto cone e capa da série em polegadas, muito usado na linha pesada.',
    },
    {
      codigo: '6205-2RS',
      nome: 'Rolamento rígido de esferas vedado',
      segmento: 'INDUSTRIAL',
      categoria: 'Rolamentos de Esferas',
      medidas: [25, 52, 15, 0.13],
      aplicacoes: 'Motores elétricos, bombas centrífugas e redutores.',
      descricao: 'Duas vedações de borracha, lubrificado de fábrica para toda a vida útil.',
    },
    {
      codigo: '6306-2Z',
      nome: 'Rolamento rígido de esferas blindado',
      segmento: 'AGRICOLA',
      categoria: 'Rolamentos de Esferas',
      medidas: [30, 72, 19, 0.35],
      aplicacoes: 'Plantadeiras, colheitadeiras e implementos agrícolas.',
      descricao: 'Duas blindagens metálicas, indicado para rotações mais altas.',
    },
    {
      codigo: 'NU 2209 E',
      nome: 'Rolamento de rolos cilíndricos',
      segmento: 'INDUSTRIAL',
      categoria: 'Rolamentos de Rolos Cilíndricos',
      medidas: [45, 85, 23, 0.58],
      aplicacoes: 'Redutores, motores de grande porte e caixas de engrenagens.',
      descricao: 'Anel externo com dois rebordos; o anel interno desliza axialmente.',
    },
    {
      codigo: '22212 E',
      nome: 'Rolamento autocompensador de rolos',
      segmento: 'AGRICOLA',
      categoria: 'Rolamentos Autocompensadores de Rolos',
      medidas: [60, 110, 28, 1.15],
      aplicacoes: 'Transportadores, peneiras vibratórias e tratores.',
      descricao: 'Compensa desalinhamentos do eixo e suporta cargas radiais elevadas.',
    },
    {
      codigo: 'HK 2520',
      nome: 'Bucha de agulhas',
      segmento: 'LEVE',
      categoria: 'Rolamentos de Agulhas',
      medidas: [25, 32, 20, 0.03],
      aplicacoes: 'Câmbios manuais, alavancas e articulações.',
      descricao: 'Anel externo estampado, ocupa pouco espaço radial.',
    },
    {
      codigo: 'UCP 205',
      nome: 'Mancal com rolamento (unidade)',
      segmento: 'AGRICOLA',
      categoria: 'Unidades de Rolamentos',
      medidas: [25, null, null, 0.8],
      aplicacoes: 'Esteiras, transportadores e máquinas agrícolas.',
      descricao: 'Mancal de ferro fundido com rolamento de inserção e graxeira.',
    },
    {
      codigo: 'FXC 2041',
      nome: 'Cubo de roda dianteiro (kit)',
      segmento: 'LEVE',
      categoria: 'Kits de Roda para Turismo',
      medidas: null,
      aplicacoes: 'Eixo dianteiro de automóveis compactos com freio a disco.',
      descricao: 'Kit com cubo, rolamento integrado, porca e arruela de trava. Código fictício.',
    },
    {
      codigo: 'FXE 330',
      nome: 'Rolamento de embreagem',
      segmento: 'PESADA',
      categoria: 'Rolamentos de embreagem',
      medidas: null,
      aplicacoes: 'Caminhões médios e pesados com embreagem de 395 mm.',
      descricao: 'Rolamento de acionamento da embreagem com flange guia. Código fictício.',
    },
  ];
  const produtosCriados = await db
    .insert(produtos)
    .values(
      listaDeProdutos.map(({ categoria, medidas, ...produto }) => ({
        ...produto,
        categoriaId: categoriaPorNome[categoria]!,
        diametroInternoMm: medidas?.[0] ?? null,
        diametroExternoMm: medidas?.[1] ?? null,
        larguraMm: medidas?.[2] ?? null,
        pesoKg: medidas?.[3] ?? null,
      })),
    )
    .returning({ id: produtos.id, codigo: produtos.codigo });
  const produtoPorCodigo = Object.fromEntries(produtosCriados.map((p) => [p.codigo, p.id]));

  await garantirPastaDeUploads();

  const listaDeDocumentos: {
    titulo: string;
    descricao: string;
    tipo: TipoDocumento;
    visibilidade: Visibilidade;
    publicado?: boolean;
    arquivo?: string;
    link?: string;
    produtos: string[];
    liberadoPara?: string[];
  }[] = [
    {
      titulo: 'Catálogo geral de rolamentos 2026',
      descricao: 'Linhas leve, pesada, agrícola e industrial com códigos, medidas e siglas de vedação.',
      tipo: 'CATALOGO',
      visibilidade: 'PUBLICO',
      arquivo: 'catalogo-geral-2026.pdf',
      produtos: Object.keys(produtoPorCodigo),
    },
    {
      titulo: 'Guia de montagem: rolamentos de rolos cônicos',
      descricao: 'Procedimento de montagem em cubos de roda e eixos, do preparo da sede ao ajuste da folga axial.',
      tipo: 'MANUAL',
      visibilidade: 'PUBLICO',
      arquivo: 'guia-montagem-rolos-conicos.pdf',
      produtos: ['30205', '32008 X'],
    },
    {
      titulo: 'Ficha técnica 30205',
      descricao: 'Medidas, capacidades de carga e massa do rolamento de rolos cônicos 30205.',
      tipo: 'FICHA_TECNICA',
      visibilidade: 'PUBLICO',
      arquivo: 'ficha-tecnica-30205.pdf',
      produtos: ['30205'],
    },
    {
      titulo: 'Como medir a folga axial no cubo de roda',
      descricao: 'Vídeo curto mostrando a medição com relógio comparador antes do travamento da porca.',
      tipo: 'VIDEO',
      visibilidade: 'AUTENTICADO',
      arquivo: 'medicao-folga-axial.mp4',
      produtos: ['30205', 'FXC 2041'],
    },
    {
      titulo: 'Boletim técnico 07/2026: torque de aperto em cubos de roda',
      descricao: 'Retornos por ruído após a troca do rolamento e como evitar aperto excessivo.',
      tipo: 'BOLETIM',
      visibilidade: 'AUTENTICADO',
      arquivo: 'boletim-07-2026-torque-cubos.pdf',
      produtos: ['FXC 2041', '30205'],
    },
    {
      titulo: 'Treinamento: diagnóstico de ruídos em rolamentos',
      descricao: 'Módulo 1: identificar a origem do ruído antes de trocar a peça, com exercício prático.',
      tipo: 'TREINAMENTO',
      visibilidade: 'AUTENTICADO',
      arquivo: 'treinamento-diagnostico-ruidos.pdf',
      produtos: [],
    },
    {
      titulo: 'Condições comerciais para distribuidores',
      descricao: 'Pedido mínimo e prazos por linha de produto. Disponível só para distribuidores selecionados.',
      tipo: 'OUTRO',
      visibilidade: 'RESTRITO',
      arquivo: 'condicoes-comerciais-distribuidores.pdf',
      produtos: [],
      liberadoPara: ['distribuidor@exemplo.com'],
    },
    {
      titulo: 'Busca de aplicações por veículo no site FERSA',
      descricao: 'Pesquisa por marca, modelo e motor no site oficial da FERSA.',
      tipo: 'CATALOGO',
      visibilidade: 'PUBLICO',
      link: 'https://brasil.fersa.com/',
      produtos: [],
    },
    {
      titulo: 'Manual de montagem: rolamento de embreagem',
      descricao: 'Rascunho em revisão pela engenharia de aplicação.',
      tipo: 'MANUAL',
      visibilidade: 'AUTENTICADO',
      publicado: false,
      arquivo: 'manual-rolamento-embreagem.pdf',
      produtos: ['FXE 330'],
    },
  ];

  const documentosPublicados: string[] = [];
  for (const item of listaDeDocumentos) {
    const conteudo = item.arquivo
      ? await copiarArquivoDeExemplo(item.arquivo)
      : { urlExterna: item.link! };

    const [documento] = await db
      .insert(documentos)
      .values({
        titulo: item.titulo,
        descricao: item.descricao,
        tipo: item.tipo,
        visibilidade: item.visibilidade,
        publicado: item.publicado ?? true,
        criadoPor: admin?.id ?? null,
        ...conteudo,
      })
      .returning({ id: documentos.id });
    const documentoId = documento!.id;
    if (item.publicado !== false) documentosPublicados.push(documentoId);

    if (item.produtos.length > 0) {
      await db
        .insert(documentoProdutos)
        .values(item.produtos.map((codigo) => ({ documentoId, produtoId: produtoPorCodigo[codigo]! })));
    }
    if (item.liberadoPara?.length) {
      await db
        .insert(documentoAcessos)
        .values(item.liberadoPara.map((email) => ({ documentoId, usuarioId: clientePorEmail[email]! })));
    }
  }

  const sorteio = aleatorio(2026);
  const leitores = [null, null, clientePorEmail['oficina@exemplo.com']!, clientePorEmail['distribuidor@exemplo.com']!];
  const visualizacoes = Array.from({ length: 60 }, () => {
    const diasAtras = Math.floor(sorteio() * 14);
    const indiceDocumento = Math.floor(Math.pow(sorteio(), 1.6) * documentosPublicados.length);
    return {
      documentoId: documentosPublicados[indiceDocumento]!,
      usuarioId: leitores[Math.floor(sorteio() * leitores.length)] ?? null,
      criadoEm: new Date(Date.now() - diasAtras * 86_400_000 - Math.floor(sorteio() * 36_000_000)),
    };
  });
  await db.insert(documentoVisualizacoes).values(visualizacoes);

  console.log(`✅ Dados de exemplo criados: ${clientes.length} clientes, ${categoriasCriadas.length} categorias, ${produtosCriados.length} produtos, ${listaDeDocumentos.length} documentos.`);
  console.log(`   Clientes de exemplo (senha "${SENHA_CLIENTES_EXEMPLO}"):`);
  console.log('   - oficina@exemplo.com       ativo');
  console.log('   - distribuidor@exemplo.com  ativo, com acesso ao documento restrito');
  console.log('   - pendente@exemplo.com      aguardando aprovação');
}

const comExemplos = process.argv.includes('--exemplos') || process.env.SEED_EXEMPLOS === 'true';

try {
  await garantirAdministrador();
  if (comExemplos) await inserirExemplos();
} catch (erro) {
  console.error('❌ Falha ao popular o banco:', erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await pool.end();
}
