import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

interface TipoPermitido {
  mime: string;
  exibirNoNavegador: boolean;
}

// Manter igual a EXTENSOES_ACEITAS (frontend/src/config.ts) e coberto por CONFERENCIAS (assinaturas.ts).
export const TIPOS_PERMITIDOS: Record<string, TipoPermitido> = {
  '.pdf': { mime: 'application/pdf', exibirNoNavegador: true },
  '.png': { mime: 'image/png', exibirNoNavegador: true },
  '.jpg': { mime: 'image/jpeg', exibirNoNavegador: true },
  '.jpeg': { mime: 'image/jpeg', exibirNoNavegador: true },
  '.webp': { mime: 'image/webp', exibirNoNavegador: true },
  '.mp4': { mime: 'video/mp4', exibirNoNavegador: true },
  '.webm': { mime: 'video/webm', exibirNoNavegador: true },
  '.txt': { mime: 'text/plain; charset=utf-8', exibirNoNavegador: true },
  '.csv': { mime: 'text/csv; charset=utf-8', exibirNoNavegador: false },
  '.doc': { mime: 'application/msword', exibirNoNavegador: false },
  '.docx': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    exibirNoNavegador: false,
  },
  '.xls': { mime: 'application/vnd.ms-excel', exibirNoNavegador: false },
  '.xlsx': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    exibirNoNavegador: false,
  },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', exibirNoNavegador: false },
  '.pptx': {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    exibirNoNavegador: false,
  },
  '.zip': { mime: 'application/zip', exibirNoNavegador: false },
};

export const EXTENSOES_PERMITIDAS = Object.keys(TIPOS_PERMITIDOS);

// Manter igual a EXTENSOES / LIMITE_MB em frontend/src/paginas/admin/CampoImagem.tsx.
export const EXTENSOES_DE_IMAGEM = ['.png', '.jpg', '.jpeg', '.webp'];
export const IMAGEM_LIMITE_MB = 5;

export function extensaoDe(nomeArquivo: string): string {
  return path.extname(nomeArquivo).toLowerCase();
}

export function tipoDoArquivo(nomeArquivo: string): TipoPermitido | undefined {
  return TIPOS_PERMITIDOS[extensaoDe(nomeArquivo)];
}

export function gerarChave(nomeOriginal: string): string {
  return `${crypto.randomUUID()}${extensaoDe(nomeOriginal)}`;
}

/** O `basename` impede que uma chave aponte para fora da pasta de uploads (ex.: "../../etc/passwd"). */
export function caminhoDoArquivo(chave: string): string {
  return path.join(env.UPLOAD_DIR, path.basename(chave));
}

export async function gravarArquivo(chave: string, conteudo: Buffer): Promise<void> {
  await fs.writeFile(caminhoDoArquivo(chave), conteudo);
}

export async function removerArquivo(chave: string | null | undefined): Promise<void> {
  if (!chave) return;
  await fs.rm(caminhoDoArquivo(chave), { force: true });
}

export async function arquivoExiste(chave: string): Promise<boolean> {
  try {
    await fs.access(caminhoDoArquivo(chave));
    return true;
  } catch {
    return false;
  }
}

export async function garantirPastaDeUploads(): Promise<void> {
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
}
