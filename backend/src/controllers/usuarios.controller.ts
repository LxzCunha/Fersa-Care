import type { Request, Response } from 'express';
import { esquemaParametroId } from '../lib/validacao.js';
import { usuarioLogado } from '../middlewares/autenticacao.js';
import * as usuariosService from '../services/usuarios.service.js';
import {
  esquemaAlterarStatus,
  esquemaAtualizarUsuario,
  esquemaCriarUsuario,
  esquemaFiltrosUsuarios,
} from '../validators/usuarios.validator.js';

export async function listar(req: Request, res: Response) {
  const filtros = esquemaFiltrosUsuarios.parse(req.query);
  res.json(await usuariosService.listarUsuarios(filtros));
}

export async function detalhar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await usuariosService.detalharUsuario(id));
}

export async function criar(req: Request, res: Response) {
  const dados = esquemaCriarUsuario.parse(req.body);
  res.status(201).json(await usuariosService.criarUsuario(dados));
}

export async function atualizar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const dados = esquemaAtualizarUsuario.parse(req.body);
  res.json(await usuariosService.atualizarUsuario(id, dados, usuarioLogado(req).id));
}

export async function alterarStatus(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const { status } = esquemaAlterarStatus.parse(req.body);
  res.json(await usuariosService.alterarStatus(id, status, usuarioLogado(req).id));
}

export async function excluir(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  await usuariosService.excluirUsuario(id, usuarioLogado(req).id);
  res.status(204).end();
}
