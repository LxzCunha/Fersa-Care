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

/**
 * Recebe UM arquivo de um formulário multipart e grava direto na pasta de
 * uploads com nome gerado pelo sistema. Se a requisição terminar com erro
 * (validação, permissão...), o arquivo gravado é apagado para não deixar lixo.
 */
function criarUpload({ campo, extensoes, limiteMb }: { campo: string; extensoes: string[]; limiteMb: number }) {
  const receber = multer({
    storage: multer.diskStorage({
      destination: (_req, _arquivo, callback) => callback(null, env.UPLOAD_DIR),
      filename: (_req, arquivo, callback) => callback(null, gerarChave(arquivo.originalname)),
    }),
    limits: {
      fileSize: limiteMb * 1024 * 1024,
      files: 1,
      fields: 20,
    },
    // Sem isso, nomes com acento ("manutenção.pdf") chegam corrompidos.
    defParamCharset: 'utf8',
    fileFilter: (_req, arquivo, callback) => {
      if (extensoes.includes(extensaoDe(arquivo.originalname))) return callback(null, true);
      callback(
        new ErroHttp(
          400,
          'TIPO_DE_ARQUIVO_INVALIDO',
          `Tipo de arquivo não permitido. Envie um destes formatos: ${extensoes.join(', ')}.`,
        ),
      );
    },
  }).single(campo);

  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 400 && req.file) {
        void removerArquivo(req.file.filename);
      }
    });
    receber(req, res, (erro?: unknown) => {
      if (erro instanceof multer.MulterError) {
        return next(
          erro.code === 'LIMIT_FILE_SIZE'
            ? new ErroHttp(413, 'ARQUIVO_MUITO_GRANDE', `O arquivo passa do limite de ${limiteMb} MB.`)
            : new ErroHttp(400, 'UPLOAD_INVALIDO', `Envie um único arquivo no campo "${campo}".`),
        );
      }
      next(erro);
    });
  };
}

/** Arquivo de um documento, no campo "arquivo". */
export const uploadDeArquivo = criarUpload({
  campo: 'arquivo',
  extensoes: EXTENSOES_PERMITIDAS,
  limiteMb: env.UPLOAD_LIMITE_MB,
});

/** Foto de uma peça do catálogo, no campo "imagem". */
export const uploadDeImagem = criarUpload({
  campo: 'imagem',
  extensoes: EXTENSOES_DE_IMAGEM,
  limiteMb: IMAGEM_LIMITE_MB,
});
