import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/assistente';
import { ErroApi } from '../../src/api/cliente';
import type { EventoDoAssistente } from '../../src/api/tipos';
import { Assistente, SUGESTOES, TextoFormatado } from '../../src/componentes/Assistente';
import { BlocoSuporte } from '../../src/componentes/BlocoSuporte';
import { CHAVE_CONVERSA } from '../../src/contexto/Assistente';
import { umUsuario } from '../fabricas';
import { renderizar } from '../renderizar';

vi.mock('../../src/api/assistente');

/** Faz a API "responder" com estes eventos, na ordem. */
function apiResponde(...eventos: EventoDoAssistente[]) {
  vi.mocked(api.perguntarAoAssistente).mockImplementation(async (_dados, aoEvento) => {
    for (const evento of eventos) aoEvento(evento);
  });
}

const conversa = (conversaId = 'c-1'): EventoDoAssistente => ({ tipo: 'conversa', conversaId });
const fim = (dados: Partial<Extract<EventoDoAssistente, { tipo: 'fim' }>> = {}): EventoDoAssistente => ({
  tipo: 'fim',
  mensagemId: 'm-1',
  fontes: [],
  encaminhamento: 'NENHUM',
  chamado: null,
  ...dados,
});

beforeEach(() => {
  sessionStorage.clear();
});

async function abrirChat(opcoes: Parameters<typeof renderizar>[1] = {}) {
  const tela = renderizar(<Assistente />, opcoes);
  await tela.pessoa.click(screen.getByRole('button', { name: 'Abrir o assistente técnico' }));
  return { ...tela, painel: screen.getByRole('dialog', { name: 'Assistente técnico' }) };
}

describe('Bolinha e painel', () => {
  it('a bolinha abre o painel com boas-vindas, sugestões e o foco no campo', async () => {
    const { painel } = await abrirChat();
    expect(within(painel).getByText(/Pergunte sobre montagem, folga, torque/)).toBeInTheDocument();
    expect(within(painel).getAllByRole('button', { name: /\?|\./ }).map((botao) => botao.textContent)).toEqual(
      expect.arrayContaining(SUGESTOES),
    );
    expect(within(painel).getByLabelText('Sua pergunta')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Abrir o assistente técnico' })).toBeNull();
    expect(within(painel).getByText(/Respostas geradas por IA/)).toBeInTheDocument();
  });

  it('Esc ou o X fecham; a bolinha volta com o foco', async () => {
    const { pessoa } = await abrirChat();
    await pessoa.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir o assistente técnico' })).toHaveFocus();

    await pessoa.click(screen.getByRole('button', { name: 'Abrir o assistente técnico' }));
    await pessoa.click(screen.getByRole('button', { name: 'Fechar o assistente' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Conversa', () => {
  it('mostra a pergunta e a resposta aos pedaços, com citações e fontes', async () => {
    apiResponde(
      conversa(),
      { tipo: 'texto', texto: 'Meça com **relógio comparador** [1].\n\n' },
      { tipo: 'texto', texto: '1. Solte a porca\n2. Confira a folga [2]' },
      fim({
        fontes: [
          { tipo: 'DOCUMENTO', id: 'd-1', titulo: 'Guia da folga', numero: 1 },
          { tipo: 'PRODUTO', id: 'p-1', titulo: 'Peça 30205', numero: 2 },
        ],
      }),
    );
    const { pessoa, painel } = await abrirChat();
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'Como medir a folga axial?');
    await pessoa.click(within(painel).getByRole('button', { name: 'Enviar pergunta' }));

    expect(api.perguntarAoAssistente).toHaveBeenCalledWith(
      { pergunta: 'Como medir a folga axial?', conversaId: undefined },
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(within(painel).getByText('Como medir a folga axial?')).toHaveClass('assistente-mensagem-usuario');
    expect(within(painel).getByText('relógio comparador').tagName).toBe('STRONG');
    expect(within(painel).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      expect.arrayContaining(['Solte a porca', 'Confira a folga 2']),
    );

    const fontes = within(painel).getByRole('list', { name: 'Fontes' });
    expect(within(fontes).getByRole('link', { name: /Guia da folga/ })).toHaveAttribute('href', '/documentos/d-1');
    expect(within(fontes).getByRole('link', { name: /Peça 30205/ })).toHaveAttribute('href', '/produtos/p-1');
    expect(within(fontes).getByRole('link', { name: /Guia da folga/ })).toHaveTextContent('1Guia da folga');

    // O campo esvazia e o id da conversa fica guardado na aba.
    expect(within(painel).getByLabelText('Sua pergunta')).toHaveValue('');
    expect(sessionStorage.getItem(CHAVE_CONVERSA)).toBe('c-1');
  });

  it('a próxima pergunta continua a mesma conversa', async () => {
    apiResponde(conversa('c-9'), { tipo: 'texto', texto: 'Ok.' }, fim());
    const { pessoa, painel } = await abrirChat();
    await pessoa.click(within(painel).getByRole('button', { name: SUGESTOES[0] }));
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'e o torque?{Enter}');
    expect(vi.mocked(api.perguntarAoAssistente).mock.calls.map(([dados]) => dados)).toEqual([
      { pergunta: SUGESTOES[0], conversaId: undefined },
      { pergunta: 'e o torque?', conversaId: 'c-9' },
    ]);
  });

  it('Shift+Enter quebra a linha em vez de enviar', async () => {
    const { pessoa, painel } = await abrirChat();
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'linha 1{Shift>}{Enter}{/Shift}linha 2');
    expect(api.perguntarAoAssistente).not.toHaveBeenCalled();
    expect(within(painel).getByLabelText('Sua pergunta')).toHaveValue('linha 1\nlinha 2');
  });

  it('não envia pergunta vazia', async () => {
    const { painel } = await abrirChat();
    expect(within(painel).getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled();
  });

  it('erro antes da resposta (ex.: muitas perguntas) aparece no lugar dela', async () => {
    vi.mocked(api.perguntarAoAssistente).mockRejectedValue(
      new ErroApi(429, 'MUITAS_PERGUNTAS', 'Muitas perguntas em pouco tempo. Aguarde alguns minutos e tente de novo.'),
    );
    const { pessoa, painel } = await abrirChat();
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'Oi{Enter}');
    const erro = await within(painel).findByText(/Muitas perguntas em pouco tempo/);
    expect(erro.closest('.assistente-mensagem')).toHaveClass('falhou');
  });

  it('erro no meio da resposta também aparece', async () => {
    apiResponde(conversa(), { tipo: 'erro', mensagem: 'Não foi possível responder agora.' });
    const { pessoa, painel } = await abrirChat();
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'Oi{Enter}');
    expect(await within(painel).findByText('Não foi possível responder agora.')).toBeInTheDocument();
  });

  it('"Nova conversa" limpa tudo e esquece o id', async () => {
    apiResponde(conversa(), { tipo: 'texto', texto: 'Resposta.' }, fim());
    const { pessoa, painel } = await abrirChat();
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'Oi{Enter}');
    await pessoa.click(within(painel).getByRole('button', { name: 'Nova conversa' }));
    expect(within(painel).queryByText('Resposta.')).toBeNull();
    expect(within(painel).getByText(/Pergunte sobre montagem/)).toBeInTheDocument();
    expect(sessionStorage.getItem(CHAVE_CONVERSA)).toBeNull();
  });

  it('ao recarregar a página, traz a conversa guardada', async () => {
    sessionStorage.setItem(CHAVE_CONVERSA, 'c-antiga');
    vi.mocked(api.obterConversa).mockResolvedValue({
      id: 'c-antiga',
      chamado: { numero: 4 },
      mensagens: [
        { id: '1', papel: 'USUARIO', conteudo: 'Pergunta antiga', fontes: [], insatisfacao: false, criadoEm: '' },
        { id: '2', papel: 'ASSISTENTE', conteudo: 'Resposta antiga', fontes: [], insatisfacao: false, criadoEm: '' },
      ],
    });
    const { painel } = await abrirChat();
    expect(await within(painel).findByText('Resposta antiga')).toBeInTheDocument();
    expect(within(painel).getByText('Chamado nº 4 aberto. A equipe técnica vai entrar em contato.')).toBeInTheDocument();
    expect(api.obterConversa).toHaveBeenCalledWith('c-antiga');
  });

  it('conversa guardada que não existe mais é esquecida', async () => {
    sessionStorage.setItem(CHAVE_CONVERSA, 'c-sumiu');
    vi.mocked(api.obterConversa).mockRejectedValue(new ErroApi(404, 'NAO_ENCONTRADO', 'Conversa não encontrada.'));
    const { painel } = await abrirChat();
    await waitFor(() => expect(sessionStorage.getItem(CHAVE_CONVERSA)).toBeNull());
    expect(within(painel).getByText(/Pergunte sobre montagem/)).toBeInTheDocument();
  });
});

describe('Chamado com a equipe técnica', () => {
  it('cliente logado: depois da reclamação, um botão abre o chamado com os dados da conta', async () => {
    apiResponde(conversa('c-5'), { tipo: 'texto', texto: 'Tente apertar de novo.' }, fim({ encaminhamento: 'SUGERIR_CHAMADO' }));
    vi.mocked(api.abrirChamado).mockResolvedValue({ numero: 7, mensagem: 'Abri o chamado nº 7 com a equipe técnica da FERSA.' });
    const { pessoa, painel } = await abrirChat({ usuario: umUsuario() });
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'não ajudou{Enter}');

    await pessoa.click(await within(painel).findByRole('button', { name: 'Abrir chamado com a equipe técnica' }));
    expect(api.abrirChamado).toHaveBeenCalledWith('c-5', {});
    expect(await within(painel).findByText('Chamado nº 7 aberto. A equipe técnica vai entrar em contato.')).toBeInTheDocument();
    expect(within(painel).getByText('Abri o chamado nº 7 com a equipe técnica da FERSA.')).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Abrir chamado com a equipe técnica' })).toBeNull();
  });

  it('visitante: o chat pede o contato; erros aparecem nos campos', async () => {
    apiResponde(conversa('c-6'), { tipo: 'texto', texto: 'Para abrir o chamado, deixe seu contato.' }, fim({ encaminhamento: 'PEDIR_CONTATO' }));
    vi.mocked(api.abrirChamado)
      .mockRejectedValueOnce(
        new ErroApi(400, 'DADOS_INVALIDOS', 'Informe seu nome.', [
          { campo: 'nome', mensagem: 'Informe seu nome.' },
          { campo: 'email', mensagem: 'Informe um e-mail ou um telefone para a equipe falar com você.' },
        ]),
      )
      .mockResolvedValueOnce({ numero: 8, mensagem: 'Abri o chamado nº 8.' });
    const { pessoa, painel } = await abrirChat();
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'quero falar com um atendente{Enter}');

    const formulario = await within(painel).findByRole('form', { name: 'Contato para o chamado' });
    await pessoa.click(within(formulario).getByRole('button', { name: 'Abrir chamado' }));
    expect(await within(formulario).findByText('Informe seu nome.')).toBeInTheDocument();
    expect(within(formulario).getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');

    await pessoa.type(within(formulario).getByLabelText('Nome'), 'Rafael Souza');
    await pessoa.type(within(formulario).getByLabelText('Telefone ou WhatsApp'), '(41) 99999-0003');
    await pessoa.click(within(formulario).getByRole('button', { name: 'Abrir chamado' }));
    expect(api.abrirChamado).toHaveBeenLastCalledWith('c-6', { nome: 'Rafael Souza', email: '', telefone: '(41) 99999-0003' });
    expect(await within(painel).findByText('Chamado nº 8 aberto. A equipe técnica vai entrar em contato.')).toBeInTheDocument();
  });

  it('chamado aberto pelo próprio assistente (cliente insistiu) aparece na hora', async () => {
    apiResponde(
      conversa(),
      { tipo: 'texto', texto: 'Abri o chamado nº 3.' },
      fim({ encaminhamento: 'CHAMADO_ABERTO', chamado: { numero: 3 } }),
    );
    const { pessoa, painel } = await abrirChat({ usuario: umUsuario() });
    await pessoa.type(within(painel).getByLabelText('Sua pergunta'), 'não está ajudando{Enter}');
    expect(await within(painel).findByText('Chamado nº 3 aberto. A equipe técnica vai entrar em contato.')).toBeInTheDocument();
  });
});

describe('Atalhos para o assistente', () => {
  it('"Perguntar ao assistente" abre o chat com o assunto já no campo', async () => {
    const { pessoa } = renderizar(
      <>
        <BlocoSuporte assunto="a peça 30205" />
        <Assistente />
      </>,
    );
    await pessoa.click(screen.getByRole('button', { name: 'Perguntar ao assistente' }));
    expect(screen.getByLabelText('Sua pergunta')).toHaveValue('Sobre a peça 30205: ');
  });
});

describe('Texto da resposta', () => {
  it('nada vindo do modelo vira HTML', () => {
    const { container } = renderizar(<TextoFormatado texto={'<img src=x onerror="alert(1)"> **ok**'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)"> ok');
  });

  it('parágrafos, listas com marcador e quebras de linha', () => {
    const { container } = renderizar(<TextoFormatado texto={'Primeiro.\nContinua.\n\n- item a\n- item b\n\nFim [3].'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelector('ul')?.textContent).toBe('item aitem b');
    expect(container.querySelector('br')).not.toBeNull();
    expect(container.querySelector('sup')).toHaveTextContent('3');
  });
});
