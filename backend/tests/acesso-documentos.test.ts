import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, criarAdmin, criarDocumento, criarUsuario, entrarComo } from './ajudantes.js';

/**
 *                       PUBLICO  AUTENTICADO  RESTRITO  RASCUNHO
 *   visitante             200        401         401       404
 *   usuário               200        200         404       404
 *   usuário liberado      200        200         200       404
 *   admin                 200        200         200       200
 * 401 = "entre com sua conta"; 404 = não existe ou sem permissão (não revela).
 */

type Ator = 'visitante' | 'usuario' | 'usuarioLiberado' | 'admin';
type Caso = 'PUBLICO' | 'AUTENTICADO' | 'RESTRITO' | 'RASCUNHO';

const MATRIZ: Record<Ator, Record<Caso, number>> = {
  visitante: { PUBLICO: 200, AUTENTICADO: 401, RESTRITO: 401, RASCUNHO: 404 },
  usuario: { PUBLICO: 200, AUTENTICADO: 200, RESTRITO: 404, RASCUNHO: 404 },
  usuarioLiberado: { PUBLICO: 200, AUTENTICADO: 200, RESTRITO: 200, RASCUNHO: 404 },
  admin: { PUBLICO: 200, AUTENTICADO: 200, RESTRITO: 200, RASCUNHO: 200 },
};

describe('Matriz de acesso aos documentos', () => {
  let ids: Record<Caso, string>;
  let agentes: Record<Ator, ReturnType<typeof request.agent>>;

  beforeEach(async () => {
    const admin = await criarAdmin();
    const usuario = await criarUsuario();
    const liberado = await criarUsuario();

    ids = {
      PUBLICO: (await criarDocumento({ titulo: 'Doc público', visibilidade: 'PUBLICO' })).id,
      AUTENTICADO: (await criarDocumento({ titulo: 'Doc autenticado', visibilidade: 'AUTENTICADO' })).id,
      RESTRITO: (
        await criarDocumento({ titulo: 'Doc restrito', visibilidade: 'RESTRITO', liberadoPara: [liberado.id] })
      ).id,
      RASCUNHO: (await criarDocumento({ titulo: 'Doc rascunho', visibilidade: 'PUBLICO', publicado: false })).id,
    };

    agentes = {
      visitante: request.agent(app),
      usuario: await entrarComo(usuario),
      usuarioLiberado: await entrarComo(liberado),
      admin: await entrarComo(admin),
    };
  });

  for (const [ator, esperado] of Object.entries(MATRIZ) as [Ator, Record<Caso, number>][]) {
    for (const [caso, status] of Object.entries(esperado) as [Caso, number][]) {
      it(`${ator} → documento ${caso}: detalhe e arquivo respondem ${status}`, async () => {
        const detalhe = await agentes[ator].get(`/api/documentos/${ids[caso]}`);
        expect(detalhe.status).toBe(status);

        const arquivo = await agentes[ator].get(`/api/documentos/${ids[caso]}/arquivo`);
        expect(arquivo.status).toBe(status);
        if (status === 200) expect(arquivo.headers['content-type']).toContain('application/pdf');
      });
    }

    it(`${ator}: a biblioteca lista exatamente os documentos permitidos`, async () => {
      const resposta = await agentes[ator].get('/api/documentos');
      expect(resposta.status).toBe(200);

      // Rascunhos nunca aparecem na biblioteca do portal (nem para admin).
      const esperados = (Object.keys(esperado) as Caso[])
        .filter((caso) => caso !== 'RASCUNHO' && esperado[caso] === 200)
        .map((caso) => ids[caso])
        .sort();
      const recebidos = resposta.body.itens.map((item: { id: string }) => item.id).sort();
      expect(recebidos).toEqual(esperados);
      expect(resposta.body.total).toBe(esperados.length);
    });
  }

  it('não expõe o nome interno do arquivo no servidor', async () => {
    const resposta = await agentes.admin.get(`/api/documentos/${ids.PUBLICO}`);
    expect(JSON.stringify(resposta.body)).not.toContain('arquivoChave');
  });

  it('o resumo da página inicial respeita a visibilidade', async () => {
    const visitante = await agentes.visitante.get('/api/documentos/resumo');
    expect(visitante.body.totalDocumentos).toBe(1);
    expect(visitante.body.materiaisExclusivos).toBe(1); // o AUTENTICADO

    const usuario = await agentes.usuario.get('/api/documentos/resumo');
    expect(usuario.body.totalDocumentos).toBe(2);
    expect(usuario.body.materiaisExclusivos).toBeNull();
  });

  it('usuário desativado perde o acesso na hora, mesmo com o cookie ainda válido', async () => {
    const pessoa = await criarUsuario();
    const agente = await entrarComo(pessoa);
    expect((await agente.get(`/api/documentos/${ids.AUTENTICADO}`)).status).toBe(200);

    await agentes.admin.patch(`/api/admin/usuarios/${pessoa.id}/status`).send({ status: 'INATIVO' }).expect(200);

    expect((await agente.get(`/api/documentos/${ids.AUTENTICADO}`)).status).toBe(401);
    expect((await agente.get('/api/auth/eu')).body.usuario).toBeNull();
  });

  it('link externo redireciona somente para quem tem acesso', async () => {
    const link = await criarDocumento({ visibilidade: 'AUTENTICADO', link: 'https://exemplo.com/video' });

    expect((await agentes.visitante.get(`/api/documentos/${link.id}/arquivo`)).status).toBe(401);

    const resposta = await agentes.usuario.get(`/api/documentos/${link.id}/arquivo`);
    expect(resposta.status).toBe(302);
    expect(resposta.headers.location).toBe('https://exemplo.com/video');
  });
});
