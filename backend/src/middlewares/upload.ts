import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import {
  EXTENSOES_DE_IMAGEM,
  EXTENSOES_PERMITIDAS,
  extensaoDe,
  gerarChave,
  IMAGEM_LIMITE_MB,
  removerArquivo,
} from '../lib/armazenamento.js';
import { ErroHttp } from '../lib/erros.js';

interface CampoDeArquivo {
  nome: string;
  extensoes: string[];
  limiteMb: number;
}

const MB = 1024 * 1024;

/**
 * Recebe os arquivos de um formulário multipart (no máximo um por campo) e
 * grava direto na pasta de uploads com nome gerado pelo sistema. Se a
 * requisição terminar com erro (validação, permissão...), os arquivos gravados
 * são apagados para não deixar lixo.
 */
function criarUpload(campos: CampoDeArquivo[]) {
  const campoPorNome = new Map(campos.map((campo) => [campo.nome, campo]));

  const receber = multer({
    storage: multer.diskStorage({
      destination: (_req, _arquivo, callback) => callback(null, env.UPLOAD_DIR),
      filename: (_req, arquivo, callback) => callback(null, gerarChave(arquivo.originalname)),
    }),
    limits: {
      // O multer só aceita um limite para todos os campos: o maior. Os menores são conferidos depois.
      fileSize: Math.max(...campos.map((campo) => campo.limiteMb)) * MB,
      files: campos.length,
      fields: 20,
    },
    // Sem isso, nomes com acento ("manutenção.pdf") chegam corrompidos.
    defParamCharset: 'utf8',
    fileFilter: (_req, arquivo, callback) => {
      const { extensoes } = campoPorNome.get(arquivo.fieldname)!;
      if (extensoes.includes(extensaoDe(arquivo.originalname))) return callback(null, true);
      callback(
        erroNoCampo(
          400,
          'TIPO_DE_ARQUIVO_INVALIDO',
          arquivo.fieldname,
          `Tipo de arquivo não permitido. Envie um destes formatos: ${extensoes.join(', ')}.`,
        ),
      );
    },
  }).fields(campos.map((campo) => ({ name: campo.nome, maxCount: 1 })));

  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        for (const arquivo of todosOsArquivos(req)) void removerArquivo(arquivo.filename);
      }
    });
    receber(req, res, (erro?: unknown) => {
      if (erro instanceof multer.MulterError) {
        const campo = erro.field ? campoPorNome.get(erro.field) : undefined;
        return next(
          erro.code === 'LIMIT_FILE_SIZE' && campo
            ? erroDeTamanho(campo)
            : new ErroHttp(400, 'UPLOAD_INVALIDO', `Envie um único arquivo em cada campo (${[...campoPorNome.keys()].join(', ')}).`),
        );
      }
      if (erro) return next(erro);

      const grandeDemais = campos.find((campo) => (arquivoEnviado(req, campo.nome)?.size ?? 0) > campo.limiteMb * MB);
      next(grandeDemais ? erroDeTamanho(grandeDemais) : undefined);
    });
  };
}

function erroNoCampo(status: number, codigo: string, campo: string, mensagem: string) {
  return new ErroHttp(status, codigo, mensagem, [{ campo, mensagem }]);
}

function erroDeTamanho(campo: CampoDeArquivo) {
  return erroNoCampo(413, 'ARQUIVO_MUITO_GRANDE', campo.nome, `O arquivo passa do limite de ${campo.limiteMb} MB.`);
}

function todosOsArquivos(req: Request): Express.Multer.File[] {
  if (!req.files) return [];
  return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
}

/** O arquivo recebido no campo `campo`, se veio um. */
export function arquivoEnviado(req: Request, campo: string): Express.Multer.File | undefined {
  if (!req.files || Array.isArray(req.files)) return undefined;
  return req.files[campo]?.[0];
}

/** Documento: o arquivo (campo "arquivo") e, se o admin quiser, uma capa própria (campo "capa"). */
export const uploadDeDocumento = criarUpload([
  { nome: 'arquivo', extensoes: EXTENSOES_PERMITIDAS, limiteMb: env.UPLOAD_LIMITE_MB },
  { nome: 'capa', extensoes: EXTENSOES_DE_IMAGEM, limiteMb: IMAGEM_LIMITE_MB },
]);

/** Foto de uma peça do catálogo, no campo "imagem". */
export const uploadDeImagem = criarUpload([{ nome: 'imagem', extensoes: EXTENSOES_DE_IMAGEM, limiteMb: IMAGEM_LIMITE_MB }]);
