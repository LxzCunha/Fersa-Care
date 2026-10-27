import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CampoArquivo } from '../../src/paginas/admin/CampoArquivo';
import { CampoImagem } from '../../src/paginas/admin/CampoImagem';
import { Abas, BarraBusca, FiltroNaBusca, Janela, Marcador, RodapeLista } from '../../src/paginas/admin/Cadastro';
import { paginaAtual, trilhaDaPagina } from '../../src/paginas/admin/menu';
import { renderizar } from '../renderizar';

describe('Abas de filtro', () => {
  const opcoes = [
    { rotulo: 'Todos', contagem: 4 },
    { valor: 'PENDENTE', rotulo: 'Aguardando aprovação', contagem: 1 },
    { valor: 'ATIVO', rotulo: 'Ativos', contagem: 1_234 },
  ];

  it('marca a aba escolhida (aria-pressed) e mostra as contagens', () => {
    renderizar(<Abas rotulo="Situação" opcoes={opcoes} valor="PENDENTE" aoMudar={() => undefined} />);
    expect(screen.getByRole('group', { name: 'Situação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aguardando aprovação/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Ativos/ })).toHaveTextContent('1.234');
  });

  it('"Todos" corresponde a nenhum filtro (undefined)', () => {
    renderizar(<Abas rotulo="Situação" opcoes={opcoes} valor={undefined} aoMudar={() => undefined} />);
    expect(screen.getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('avisa o valor da aba clicada', async () => {
    const aoMudar = vi.fn();
    const { pessoa } = renderizar(<Abas rotulo="Situação" opcoes={opcoes} valor={undefined} aoMudar={aoMudar} />);
    await pessoa.click(screen.getByRole('button', { name: /Ativos/ }));
    await pessoa.click(screen.getByRole('button', { name: /Todos/ }));
    expect(aoMudar.mock.calls).toEqual([['ATIVO'], [undefined]]);
  });
});

describe('Busca e filtros da lista', () => {
  it('a busca devolve o texto digitado e tem nome para leitores de tela', async () => {
    function Teste() {
      const [valor, setValor] = useState('');
      return (
        <>
          <BarraBusca rotulo="Buscar por código" valor={valor} aoMudar={setValor} />
          <output>{valor}</output>
        </>
      );
    }
    const { pessoa } = renderizar(<Teste />);
    await pessoa.type(screen.getByRole('searchbox', { name: 'Buscar por código' }), '30205');
    expect(document.querySelector('output')).toHaveTextContent('30205');
  });

  it('o filtro lista "Todas" + as opções e devolve undefined para "Todas"', async () => {
    const aoMudar = vi.fn();
    const { pessoa } = renderizar(
      <FiltroNaBusca
        rotulo="Categoria"
        rotuloTodos="Todas"
        valor={undefined}
        aoMudar={aoMudar}
        opcoes={[
          { valor: 'c1', rotulo: 'Rolamentos de Esferas' },
          { valor: 'c2', rotulo: 'Rolamentos de Agulhas' },
        ]}
      />,
    );
    const seletor = screen.getByRole('combobox', { name: 'Categoria' });
    expect([...seletor.querySelectorAll('option')].map((opcao) => opcao.textContent)).toEqual([
      'Todas',
      'Rolamentos de Esferas',
      'Rolamentos de Agulhas',
    ]);
    await pessoa.selectOptions(seletor, 'c2');
    expect(aoMudar).toHaveBeenLastCalledWith('c2');
  });

  it('o filtro devolve undefined ao voltar para "Todas"', async () => {
    const aoMudar = vi.fn();
    const { pessoa } = renderizar(
      <FiltroNaBusca rotulo="Linha" valor="LEVE" aoMudar={aoMudar} opcoes={[{ valor: 'LEVE', rotulo: 'Linha leve' }]} />,
    );
    await pessoa.selectOptions(screen.getByRole('combobox', { name: 'Linha' }), '');
    expect(aoMudar).toHaveBeenLastCalledWith(undefined);
  });
});

describe('Marcador sim/não', () => {
  it('descreve o valor para leitores de tela', () => {
    renderizar(
      <>
        <Marcador marcado rotulo="Publicado" />
        <Marcador marcado={false} rotulo="Ativo" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Publicado: sim' })).toHaveClass('marcado');
    expect(screen.getByRole('img', { name: 'Ativo: não' })).not.toHaveClass('marcado');
  });
});

describe('Rodapé da lista', () => {
  it('uma página só: total com singular e plural', () => {
    const { rerender } = renderizar(<RodapeLista total={1} nomes={['peça', 'peças']} />);
    expect(screen.getByText('1 peça')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<RodapeLista total={12} nomes={['peça', 'peças']} />);
    expect(screen.getByText('12 peças')).toBeInTheDocument();
  });

  it('várias páginas: faixa mostrada e setas', async () => {
    const aoMudar = vi.fn();
    const { pessoa } = renderizar(
      <RodapeLista total={135} nomes={['usuário', 'usuários']} pagina={2} porPagina={20} totalPaginas={7} aoMudar={aoMudar} />,
    );
    expect(screen.getByText('21–40 de 135 usuários')).toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Próxima página' }));
    await pessoa.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(aoMudar.mock.calls).toEqual([[3], [1]]);
  });

  it('última página: faixa termina no total e a seta seguinte fica desligada', () => {
    renderizar(<RodapeLista total={45} nomes={['documento', 'documentos']} pagina={3} porPagina={20} totalPaginas={3} aoMudar={() => undefined} />);
    expect(screen.getByText('41–45 de 45 documentos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeEnabled();
  });

  it('primeira página: a seta anterior fica desligada', () => {
    renderizar(<RodapeLista total={45} nomes={['documento', 'documentos']} pagina={1} porPagina={20} totalPaginas={3} aoMudar={() => undefined} />);
    expect(screen.getByText('1–20 de 45 documentos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
  });
});

describe('Janela de cadastro', () => {
  function Formulario({ aoEnviar }: { aoEnviar: () => void }) {
    return (
      <form
        id="formulario-teste"
        onSubmit={(evento) => {
          evento.preventDefault();
          aoEnviar();
        }}
      >
        <input aria-label="Nome" />
      </form>
    );
  }

  it('abre como diálogo com o título, "Cancelar" e "Salvar"', () => {
    renderizar(
      <Janela titulo="Peça" idFormulario="formulario-teste" aoFechar={() => undefined}>
        <Formulario aoEnviar={() => undefined} />
      </Janela>,
    );
    const janela = screen.getByRole('dialog', { name: 'Peça' });
    expect(janela).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('form', 'formulario-teste');
  });

  it('"Salvar" envia o formulário de dentro da janela', async () => {
    const aoEnviar = vi.fn();
    const { pessoa } = renderizar(
      <Janela titulo="Peça" idFormulario="formulario-teste" aoFechar={() => undefined}>
        <Formulario aoEnviar={aoEnviar} />
      </Janela>,
    );
    await pessoa.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoEnviar).toHaveBeenCalledOnce();
  });

  it('sem formulário (carregando), não mostra "Salvar"', () => {
    renderizar(
      <Janela titulo="Peça" aoFechar={() => undefined}>
        Carregando...
      </Janela>,
    );
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
  });

  it('salvando: botões desligados e o percentual do envio no lugar de "Salvar"', () => {
    renderizar(
      <Janela titulo="Documento" idFormulario="f" salvando progresso={42} aoFechar={() => undefined}>
        ...
      </Janela>,
    );
    expect(screen.getByRole('button', { name: 'Enviando 42%' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Envio do arquivo' })).toHaveAttribute('aria-valuenow', '42');
  });

  it('"Cancelar" sem alterações fecha direto', async () => {
    const aoFechar = vi.fn();
    const { pessoa } = renderizar(
      <Janela titulo="Peça" idFormulario="f" aoFechar={aoFechar}>
        ...
      </Janela>,
    );
    await pessoa.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoFechar).toHaveBeenCalledOnce();
  });

  it('com alterações, "Cancelar" pergunta antes; "Descartar" fecha', async () => {
    const aoFechar = vi.fn();
    const { pessoa } = renderizar(
      <Janela titulo="Peça" idFormulario="f" alterado aoFechar={aoFechar}>
        ...
      </Janela>,
    );
    await pessoa.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Descartar as alterações?' })).toHaveAttribute('open');

    await pessoa.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(aoFechar).toHaveBeenCalledOnce();
  });

  it('com alterações, desistir de descartar mantém a janela', async () => {
    const aoFechar = vi.fn();
    const { pessoa } = renderizar(
      <Janela titulo="Peça" idFormulario="f" alterado aoFechar={aoFechar}>
        ...
      </Janela>,
    );
    await pessoa.click(screen.getByRole('button', { name: 'Cancelar' }));
    const confirmacao = screen.getByRole('dialog', { name: 'Descartar as alterações?' });
    await pessoa.click(confirmacao.querySelector('button')!);
    expect(aoFechar).not.toHaveBeenCalled();
    expect(confirmacao).not.toHaveAttribute('open');
  });

  it('Esc (evento "cancel" do diálogo) segue a mesma regra', () => {
    const aoFechar = vi.fn();
    renderizar(
      <Janela titulo="Peça" idFormulario="f" aoFechar={aoFechar}>
        ...
      </Janela>,
    );
    const cancelar = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog', { name: 'Peça' }), cancelar);
    expect(cancelar.defaultPrevented).toBe(true);
    expect(aoFechar).toHaveBeenCalledOnce();
  });

  it('mostra os links extras (ex.: "Excluir")', () => {
    renderizar(
      <Janela titulo="Peça" idFormulario="f" aoFechar={() => undefined} links={<button type="button">Excluir peça</button>}>
        ...
      </Janela>,
    );
    expect(screen.getByRole('button', { name: 'Excluir peça' })).toBeInTheDocument();
  });
});

describe('Campo de imagem (foto da peça, capa)', () => {
  const imagem = (nome: string, bytes = 100, tipo = 'image/png') => new File([new Uint8Array(bytes)], nome, { type: tipo });

  function renderizarCampo(props: Partial<Parameters<typeof CampoImagem>[0]> = {}) {
    const aoEscolher = vi.fn();
    const aoRemoverAtual = vi.fn();
    const resultado = renderizar(
      <CampoImagem
        objeto="foto"
        rotulo="Foto da peça"
        dica="Fundo branco fica melhor."
        urlAtual={null}
        arquivo={null}
        removerAtual={false}
        aoEscolher={aoEscolher}
        aoRemoverAtual={aoRemoverAtual}
        {...props}
      />,
    );
    return { ...resultado, aoEscolher, aoRemoverAtual };
  }

  it('vazio: convida a escolher e explica formatos e limite', () => {
    renderizarCampo();
    expect(screen.getByText('Escolher foto')).toBeInTheDocument();
    expect(screen.getByText(/PNG, JPG ou WebP, até 5 MB\. Fundo branco fica melhor\./)).toBeInTheDocument();
  });

  it('aceita imagem válida', async () => {
    const { pessoa, aoEscolher } = renderizarCampo();
    const arquivo = imagem('foto.png');
    await pessoa.upload(screen.getByLabelText('Foto da peça'), arquivo);
    expect(aoEscolher).toHaveBeenCalledWith(arquivo);
  });

  it('recusa formato que não é imagem, sem chamar a escolha', async () => {
    const { aoEscolher } = renderizarCampo();
    fireEvent.change(screen.getByLabelText('Foto da peça'), { target: { files: [imagem('manual.pdf', 100, 'application/pdf')] } });
    expect(await screen.findByText('Envie uma imagem PNG, JPG ou WebP.')).toBeInTheDocument();
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  it('recusa imagem acima de 5 MB', async () => {
    const { pessoa, aoEscolher } = renderizarCampo();
    await pessoa.upload(screen.getByLabelText('Foto da peça'), imagem('grande.jpg', 5 * 1024 * 1024 + 1, 'image/jpeg'));
    expect(screen.getByText('A imagem passa do limite de 5 MB.')).toBeInTheDocument();
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  it('com foto salva: mostra "Foto atual", a prévia e permite remover', async () => {
    const { pessoa, aoRemoverAtual, container } = renderizarCampo({ urlAtual: '/api/produtos/1/imagem?v=1' });
    expect(screen.getByText('Foto atual')).toBeInTheDocument();
    expect(container.querySelector('.previa-imagem img')).toHaveAttribute('src', '/api/produtos/1/imagem?v=1');
    await pessoa.click(screen.getByRole('button', { name: 'Remover foto' }));
    expect(aoRemoverAtual).toHaveBeenCalledWith(true);
  });

  it('remoção marcada: avisa e oferece desfazer', async () => {
    const { pessoa, aoRemoverAtual } = renderizarCampo({ urlAtual: '/foto.png', removerAtual: true });
    expect(screen.getByText('Foto será removida ao salvar')).toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Desfazer: manter a foto atual' }));
    expect(aoRemoverAtual).toHaveBeenCalledWith(false);
  });

  it('nova foto sobre a atual: mostra o nome e permite manter a anterior', async () => {
    const { pessoa, aoEscolher } = renderizarCampo({ urlAtual: '/foto.png', arquivo: imagem('nova.webp') });
    expect(screen.getByText('nova.webp')).toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Manter a foto anterior' }));
    expect(aoEscolher).toHaveBeenCalledWith(null);
  });

  it('erro da API aparece embaixo do campo', () => {
    renderizarCampo({ erro: 'Não foi possível ler esta imagem.' });
    expect(screen.getByText('Não foi possível ler esta imagem.')).toBeInTheDocument();
    expect(screen.getByLabelText('Foto da peça')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Campo de arquivo do documento', () => {
  it('sem arquivo: convida a escolher', () => {
    renderizar(<CampoArquivo arquivo={null} arquivoAtual={null} aoEscolher={() => undefined} />);
    expect(screen.getByText('Escolher arquivo')).toBeInTheDocument();
  });

  it('na edição: mostra o arquivo atual com o tamanho', () => {
    renderizar(<CampoArquivo arquivo={null} arquivoAtual={{ nome: 'guia.pdf', tamanho: 2_726_297 }} aoEscolher={() => undefined} />);
    expect(screen.getByText('guia.pdf (2,6 MB)')).toBeInTheDocument();
  });

  it('novo arquivo sobre o atual: avisa a substituição e permite manter o atual', async () => {
    const aoEscolher = vi.fn();
    const novo = new File(['%PDF'], 'guia-v2.pdf', { type: 'application/pdf' });
    const { pessoa } = renderizar(
      <CampoArquivo arquivo={novo} arquivoAtual={{ nome: 'guia.pdf', tamanho: 10 }} aoEscolher={aoEscolher} />,
    );
    expect(screen.getByText('Novo arquivo')).toBeInTheDocument();
    expect(screen.getByText('Substitui guia.pdf ao salvar.')).toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Manter o arquivo atual' }));
    expect(aoEscolher).toHaveBeenCalledWith(null);
  });

  it('escolher um arquivo avisa quem usa o campo', async () => {
    const aoEscolher = vi.fn();
    const { pessoa } = renderizar(<CampoArquivo arquivo={null} arquivoAtual={null} aoEscolher={aoEscolher} />);
    const arquivo = new File(['%PDF'], 'manual.pdf', { type: 'application/pdf' });
    await pessoa.upload(screen.getByLabelText('Arquivo do documento'), arquivo);
    expect(aoEscolher).toHaveBeenCalledWith(arquivo);
  });
});

describe('Menu do admin: qual página está aberta', () => {
  it.each([
    ['/admin', '', 'Painel'],
    ['/admin/documentos', '', 'Documentos'],
    ['/admin/documentos/novo', '', 'Cadastrar documento'],
    ['/admin/documentos/123', '', 'Documentos'],
    ['/admin/produtos/novo', '?ativo=true', 'Cadastrar peça'],
    ['/admin/categorias/nova', '', 'Cadastrar categoria'],
    ['/admin/usuarios', '', 'Todos os usuários'],
    ['/admin/usuarios', '?status=PENDENTE', 'Aguardando aprovação'],
    ['/admin/usuarios', '?status=ATIVO', 'Todos os usuários'],
    ['/admin/usuarios/123', '?status=PENDENTE', 'Aguardando aprovação'],
    ['/admin/chamados', '?status=ABERTO', 'Chamados abertos'],
    ['/admin/chamados/123', '', 'Todos os chamados'],
  ])('%s%s → %s', (caminho, consulta, rotulo) => {
    expect(paginaAtual(caminho, consulta)?.rotulo).toBe(rotulo);
  });

  it('o painel só fica marcado no endereço exato', () => {
    expect(paginaAtual('/admin/qualquer-coisa', '')?.rotulo).toBeUndefined();
  });
});

describe('Trilha do admin (breadcrumb)', () => {
  const PAINEL = { rotulo: 'Painel', para: '/admin' };

  it('no painel, só o painel (sem link)', () => {
    expect(trilhaDaPagina('/admin', '')).toEqual([{ rotulo: 'Painel' }]);
  });

  it('painel › grupo › página, com links para voltar', () => {
    expect(trilhaDaPagina('/admin/auditoria', '?grupo=ACESSOS')).toEqual([
      PAINEL,
      { rotulo: 'Segurança', para: '/admin/auditoria' },
      { rotulo: 'Acessos e senhas' },
    ]);
    expect(trilhaDaPagina('/admin/usuarios', '?status=PENDENTE')).toEqual([
      PAINEL,
      { rotulo: 'Usuários', para: '/admin/usuarios' },
      { rotulo: 'Aguardando aprovação' },
    ]);
    expect(trilhaDaPagina('/admin/produtos/novo', '')).toEqual([
      PAINEL,
      { rotulo: 'Catálogo', para: '/admin/produtos' },
      { rotulo: 'Cadastrar peça' },
    ]);
  });

  it('o grupo não vira link quando leva para a própria página aberta', () => {
    expect(trilhaDaPagina('/admin/auditoria', '')).toEqual([PAINEL, { rotulo: 'Segurança' }, { rotulo: 'Auditoria' }]);
  });

  it('com um registro aberto, a lista vira link (mantendo os filtros) e o registro é o último item', () => {
    expect(trilhaDaPagina('/admin/produtos/123', '?ativo=true')).toEqual([
      PAINEL,
      { rotulo: 'Catálogo', para: '/admin/produtos' },
      { rotulo: 'Peças', para: '/admin/produtos?ativo=true' },
      { rotulo: 'Editar peça' },
    ]);
    expect(trilhaDaPagina('/admin/chamados/123', '?status=ABERTO')).toEqual([
      PAINEL,
      { rotulo: 'Suporte', para: '/admin/chamados' },
      { rotulo: 'Chamados abertos', para: '/admin/chamados?status=ABERTO' },
      { rotulo: 'Chamado' },
    ]);
  });

  it('endereço fora do menu: só o link para o painel', () => {
    expect(trilhaDaPagina('/admin/qualquer-coisa', '')).toEqual([PAINEL]);
  });
});

