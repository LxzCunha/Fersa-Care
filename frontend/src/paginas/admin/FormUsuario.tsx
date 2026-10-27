import { useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  atualizarUsuario,
  criarUsuario,
  detalharUsuario,
  excluirUsuario,
  type DadosUsuario,
} from '../../api/admin';
import { ErroApi, mensagemDeErro } from '../../api/cliente';
import type { Perfil, StatusUsuario, UsuarioDetalhado } from '../../api/tipos';
import { Campo, CampoTexto } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando } from '../../componentes/Estados';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { useNotificar } from '../../contexto/Notificacoes';
import { data, dataHora } from '../../lib/formatar';
import { STATUS_USUARIO, TIPOS } from '../../lib/rotulos';
import { useRecarregarTudo } from './acoes';
import { Janela } from './Cadastro';
import { rolarJanelaParaTopo, useVoltarParaLista } from './navegacao';

export function FormUsuario() {
  const { id } = useParams();
  const fechar = useVoltarParaLista('/admin/usuarios');
  const consulta = useQuery({
    queryKey: ['admin', 'usuario', id],
    queryFn: () => detalharUsuario(id!),
    enabled: Boolean(id),
  });

  if (id && !consulta.data) {
    return (
      <Janela titulo="Usuário" largura="estreita" aoFechar={fechar}>
        {consulta.isError ? <AvisoErro erro={consulta.error} /> : <Carregando />}
      </Janela>
    );
  }
  return <FormularioUsuario key={id ?? 'novo'} usuario={consulta.data} aoFechar={fechar} />;
}

/** Senha aleatória que atende à regra da API (letras e números, 10 caracteres). */
function gerarSenha(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const todos = letras + numeros;
  const aleatorios = crypto.getRandomValues(new Uint32Array(10));
  const caracteres = Array.from(aleatorios, (valor) => todos[valor % todos.length]);
  caracteres[0] = letras[aleatorios[0]! % letras.length];
  caracteres[9] = numeros[aleatorios[9]! % numeros.length];
  return caracteres.join('');
}

const PERFIS_DO_FORMULARIO: [Perfil, string, string][] = [
  ['USUARIO', 'Cliente', 'Vê documentos públicos, de clientes e os liberados para ele.'],
  ['ADMIN', 'Administrador', 'Vê tudo e gerencia documentos, usuários e peças.'],
];

function FormularioUsuario({ usuario, aoFechar }: { usuario?: UsuarioDetalhado; aoFechar: () => void }) {
  const editando = Boolean(usuario);
  const idFormulario = useId();
  const { usuario: eu } = useAutenticacao();
  const ehEuMesmo = usuario?.id === eu?.id;
  const notificar = useNotificar();
  const recarregar = useRecarregarTudo();

  const [dados, setDados] = useState<DadosUsuario>({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    empresa: usuario?.empresa ?? '',
    telefone: usuario?.telefone ?? '',
    perfil: usuario?.perfil ?? 'USUARIO',
    status: usuario?.status ?? 'ATIVO',
  });
  const [senha, setSenha] = useState('');
  const [alterado, setAlterado] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const erroDe = (campo: string) => erro?.erroDoCampo(campo);
  const atualizar = <C extends keyof DadosUsuario>(campo: C, valor: DadosUsuario[C]) =>
    setDados((atuais) => ({ ...atuais, [campo]: valor }));

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      if (usuario) {
        await atualizarUsuario(usuario.id, { ...dados, ...(senha ? { novaSenha: senha } : {}) });
        notificar(senha ? 'Usuário atualizado e senha redefinida.' : 'Usuário atualizado.');
      } else {
        await criarUsuario({ ...dados, senha });
        notificar(`${dados.nome} foi cadastrado. Envie a senha inicial para a pessoa.`);
      }
      await recarregar();
      aoFechar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      rolarJanelaParaTopo();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!usuario) return;
    setExcluindo(true);
    try {
      await excluirUsuario(usuario.id);
      await recarregar();
      notificar('Usuário excluído.');
      aoFechar();
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  // Campos com erro de validação aparecem embaixo de cada campo; o resto vai no aviso do topo.
  const mostrarAvisoGeral = erro && (erro.detalhes.length === 0 || erro.status === 409);

  return (
    <Janela
      titulo={editando ? 'Usuário' : 'Novo usuário'}
      largura="estreita"
      idFormulario={idFormulario}
      salvando={salvando}
      alterado={alterado}
      aoFechar={aoFechar}
      links={
        usuario && (
          <>
            <span className="janela-nota">
              Cadastro em {data(usuario.criadoEm)} ·{' '}
              {usuario.ultimoAcessoEm ? `último acesso em ${dataHora(usuario.ultimoAcessoEm)}` : 'ainda não entrou'}
            </span>
            {!ehEuMesmo && (
              <button type="button" className="janela-link-perigo" onClick={() => setConfirmandoExclusao(true)}>
                Excluir usuário
              </button>
            )}
          </>
        )
      }
    >
      <form id={idFormulario} className="cadastro" onSubmit={salvar} onChange={() => setAlterado(true)} noValidate>
        {mostrarAvisoGeral && <AvisoErro erro={erro} />}

        <CampoTexto
          id="nome"
          rotulo="Nome completo"
          value={dados.nome}
          onChange={(e) => atualizar('nome', e.target.value)}
          erro={erroDe('nome')}
        />
        <CampoTexto
          id="email"
          rotulo="E-mail"
          type="email"
          value={dados.email}
          onChange={(e) => atualizar('email', e.target.value)}
          erro={erroDe('email')}
          ajuda="É o login da pessoa no portal."
        />
        <div className="cadastro-linha">
          <CampoTexto
            id="empresa"
            rotulo="Empresa"
            opcional
            value={dados.empresa}
            onChange={(e) => atualizar('empresa', e.target.value)}
            erro={erroDe('empresa')}
          />
          <CampoTexto
            id="telefone"
            rotulo="Telefone ou WhatsApp"
            opcional
            type="tel"
            value={dados.telefone}
            onChange={(e) => atualizar('telefone', e.target.value)}
            erro={erroDe('telefone')}
          />
        </div>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-acesso`}>
          <h2 id={`${idFormulario}-acesso`}>Acesso ao portal</h2>
          {ehEuMesmo && <p className="cadastro-dica">Você não pode alterar o próprio perfil nem a própria situação.</p>}
          <fieldset className="opcoes" disabled={ehEuMesmo}>
            <legend className="visualmente-oculto">Perfil</legend>
            {PERFIS_DO_FORMULARIO.map(([valor, rotulo, descricao]) => (
              <label key={valor} className="opcao">
                <input
                  type="radio"
                  name="perfil"
                  checked={dados.perfil === valor}
                  onChange={() => atualizar('perfil', valor)}
                />
                <span className="opcao-titulo">{rotulo}</span>
                <span className="opcao-descricao">{descricao}</span>
              </label>
            ))}
          </fieldset>
          <Campo id="status" rotulo="Situação" erro={erroDe('status')}>
            {(atributos) => (
              <select
                className="selecao"
                value={dados.status}
                disabled={ehEuMesmo}
                onChange={(e) => atualizar('status', e.target.value as StatusUsuario)}
                {...atributos}
              >
                {(Object.keys(STATUS_USUARIO) as StatusUsuario[]).map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {STATUS_USUARIO[opcao].rotulo}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </section>

        <section className="cadastro-secao" aria-labelledby={`${idFormulario}-senha`}>
          <h2 id={`${idFormulario}-senha`}>{editando ? 'Redefinir senha' : 'Senha inicial'}</h2>
          <Campo
            id="senha"
            rotulo={editando ? 'Nova senha' : 'Senha'}
            opcional={editando}
            erro={erroDe(editando ? 'novaSenha' : 'senha')}
            ajuda={
              editando
                ? 'Deixe em branco para manter a senha atual. Pelo menos 8 caracteres, com letras e números.'
                : 'Envie esta senha para a pessoa; ela pode trocá-la em “Minha conta”. Pelo menos 8 caracteres, com letras e números.'
            }
          >
            {(atributos) => (
              <div className="senha-gerada">
                <input
                  className="entrada"
                  type="text"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  {...atributos}
                />
                <button
                  type="button"
                  className="link-acao"
                  onClick={() => {
                    setSenha(gerarSenha());
                    setAlterado(true);
                  }}
                >
                  Gerar senha
                </button>
              </div>
            )}
          </Campo>
        </section>

        {usuario && usuario.documentosLiberados.length > 0 && (
          <section className="cadastro-secao" aria-labelledby={`${idFormulario}-liberados`}>
            <h2 id={`${idFormulario}-liberados`}>Documentos restritos liberados</h2>
            <ul className="lista-simples">
              {usuario.documentosLiberados.map((documento) => (
                <li key={documento.id}>
                  <Link to={`/admin/documentos/${documento.id}`}>{documento.titulo}</Link>{' '}
                  <span className="texto-suave">({TIPOS[documento.tipo].singular})</span>
                </li>
              ))}
            </ul>
            <p className="cadastro-dica">Para tirar o acesso, edite o documento e remova a pessoa da lista.</p>
          </section>
        )}
      </form>

      <DialogoConfirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir este usuário?"
        mensagem={`${usuario?.nome ?? ''} perde o acesso e sai das listas de documentos restritos. Para apenas bloquear, mude a situação para Inativo.`}
        textoConfirmar="Excluir usuário"
        perigoso
        processando={excluindo}
        aoCancelar={() => setConfirmandoExclusao(false)}
        aoConfirmar={excluir}
      />
    </Janela>
  );
}
