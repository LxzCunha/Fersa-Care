import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ErroHttp } from '../lib/erros.js';

/**
 * Middleware de erros: último da cadeia. Todo erro lançado em rotas e serviços
 * chega aqui e vira uma resposta JSON padronizada:
 *
 *   { "erro": { "codigo": "...", "mensagem": "...", "detalhes": [...] } }
 *
 * (No Spring, isso seria um @ControllerAdvice com @ExceptionHandler.)
 */

interface CorpoDeErro {
  erro: { codigo: string; mensagem: string; detalhes?: unknown };
}

function responder(res: Response, status: number, codigo: string, mensagem: string, detalhes?: unknown) {
  const corpo: CorpoDeErro = { erro: { codigo, mensagem } };
  if (detalhes !== undefined) corpo.erro.detalhes = detalhes;
  res.status(status).json(corpo);
}

/** O Drizzle embrulha os erros do PostgreSQL; o código original fica em `cause`. */
function erroDoPostgres(erro: unknown): { code?: string; constraint?: string } | undefined {
  const candidatos = [erro, (erro as { cause?: unknown })?.cause];
  for (const candidato of candidatos) {
    if (candidato && typeof candidato === 'object' && 'code' in candidato) {
      const { code, constraint } = candidato as { code?: unknown; constraint?: unknown };
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
        return { code, constraint: typeof constraint === 'string' ? constraint : undefined };
      }
    }
  }
  return undefined;
}

const MENSAGENS_DE_UNICIDADE: Record<string, string> = {
  usuarios_email_unico: 'Já existe um cadastro com este e-mail.',
  produtos_codigo_unico: 'Já existe um produto com este código.',
  categorias_nome_unico: 'Já existe uma categoria com este nome.',
};

export function rotaNaoEncontrada(req: Request, res: Response) {
  responder(res, 404, 'ROTA_NAO_ENCONTRADA', `Rota não encontrada: ${req.method} ${req.originalUrl}`);
}

export function tratarErros(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  if (erro instanceof ErroHttp) {
    return responder(res, erro.status, erro.codigo, erro.message, erro.detalhes);
  }

  // Validação com Zod: devolve a lista de campos com problema para o formulário.
  if (erro instanceof z.ZodError) {
    const detalhes = erro.issues.map((problema) => ({
      campo: problema.path.join('.'),
      mensagem: problema.message,
    }));
    const primeira = detalhes[0]?.mensagem ?? 'Verifique os campos informados.';
    return responder(res, 400, 'DADOS_INVALIDOS', primeira, detalhes);
  }

  if (erro instanceof multer.MulterError) {
    if (erro.code === 'LIMIT_FILE_SIZE') {
      return responder(
        res,
        413,
        'ARQUIVO_MUITO_GRANDE',
        `O arquivo passa do limite de ${env.UPLOAD_LIMITE_MB} MB.`,
      );
    }
    return responder(res, 400, 'UPLOAD_INVALIDO', 'Envie um único arquivo no campo "arquivo".');
  }

  // Erros do body-parser do Express (JSON malformado ou grande demais).
  const tipo = (erro as { type?: string })?.type;
  if (tipo === 'entity.parse.failed') {
    return responder(res, 400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }
  if (tipo === 'entity.too.large') {
    return responder(res, 413, 'CORPO_MUITO_GRANDE', 'O corpo da requisição é grande demais.');
  }

  const pg = erroDoPostgres(erro);
  if (pg?.code === '23505') {
    const mensagem = (pg.constraint && MENSAGENS_DE_UNICIDADE[pg.constraint]) ?? 'Registro duplicado.';
    return responder(res, 409, 'CONFLITO', mensagem);
  }
  if (pg?.code === '23503') {
    return responder(res, 400, 'REFERENCIA_INVALIDA', 'Um dos itens relacionados não existe mais.');
  }
  if (pg?.code === '22P02') {
    return responder(res, 400, 'DADOS_INVALIDOS', 'Identificador em formato inválido.');
  }

  console.error('Erro inesperado:', erro);
  return responder(res, 500, 'ERRO_INTERNO', 'Ocorreu um erro inesperado. Tente novamente.');
}
