import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Save, Shuffle, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  atualizarUsuario,
  criarUsuario,
  detalharUsuario,
  excluirUsuario,
  type DadosUsuario,
} from '../../api/admin';
import { ErroApi } from '../../api/cliente';
import type { Perfil, StatusUsuario, UsuarioDetalhado } from '../../api/tipos';
import { Campo, CampoTexto } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { AvisoErro, Carregando, mensagemDeErro } from '../../componentes/Estados';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { useNotificar } from '../../contexto/Notificacoes';
import { data, dataHora } from '../../lib/formatar';
import { STATUS_USUARIO, TIPOS } from '../../lib/rotulos';
import { useRecarregarTudo } from './acoes';

export function FormUsuario() {
  const { id } = useParams();
  const consulta = useQuery({
    queryKey: ['admin', 'usuario', id],
    queryFn: () => detalharUsuario(id!),
    enabled: Boolean(id),
  });

  if (id && consulta.isPending) return <Carregando />;
  if (id && consulta.isError) return <AvisoErro erro={consulta.error} />;
  return <FormularioUsuario key={id ?? 'novo'} usuario={consulta.data} />;
}

/** Senha aleatória que atende à regra da API (letras e números, 10 caracteres). */
function gerarSenha(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const todos = letras + numeros;
  const aleatorios = crypto.getRandomValues(new Uint32Array(10));
  const caracteres = Array.from(aleatorios, (valor) => todos[valor % todos.length]);
  caracteres[0] = letras[aleatorios[0] % letras.length];
  caracteres[9] = numeros[aleatorios[9] % numeros.length];
  return caracteres.join('');
}

function FormularioUsuario({ usuario }: { usuario?: UsuarioDetalhado }) {
  const editando = Boolean(usuario);
  const { usuario: eu } = useAutenticacao();
  const ehEuMesmo = usuario?.id === eu?.id;
  const navegar = useNavigate();
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
      navegar('/admin/usuarios');
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi(0, 'ERRO', mensagemDeErro(falha)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      navegar('/admin/usuarios');
    } catch (falha) {
      notificar(mensagemDeErro(falha), 'erro');
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  // Campos com erro de validação aparecem embaixo de cada campo; o resto vai no aviso do topo.
  const mostrarAvisoGeral = erro && (erro.detalhes.length === 0 || erro.status === 409);

  return (
    <>
      <title>{`${editando ? 'Editar' : 'Cadastrar'} usuário | Administração FERSA Care`}</title>

      <Link to="/admin/usuarios" className="voltar">
        <ArrowLeft aria-hidden /> Usuários
      </Link>

      <header className="admin-cabecalho">
        <div>
          <h1>{editando ? usuario?.nome : 'Cadastrar usuário'}</h1>
          {usuario && (
            <p>
              Cadastro em {data(usuario.criadoEm)}.{' '}
              {usuario.ultimoAcessoEm ? `Último acesso em ${dataHora(usuario.ultimoAcessoEm)}.` : 'Ainda não entrou no portal.'}
            </p>
          )}
        </div>
      </header>

      <form className="form-admin" onSubmit={salvar} noValidate>
        {mostrarAvisoGeral && <AvisoErro erro={erro} />}

        <section className="form-bloco" aria-labelledby="bloco-dados">
          <div className="form-bloco-titulo">
            <h2 id="bloco-dados">Dados da pessoa</h2>
          </div>
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
          <div className="linha-campos">
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
        </section>

        <section className="form-bloco" aria-labelledby="bloco-acesso">
          <div className="form-bloco-titulo">
            <h2 id="bloco-acesso">Acesso ao portal</h2>
            {ehEuMesmo && <p>Você não pode alterar o próprio perfil nem a própria situação.</p>}
          </div>
          <fieldset className="opcoes" disabled={ehEuMesmo}>
            <legend className="campo-rotulo">Perfil</legend>
            {(
              [
                ['USUARIO', 'Cliente', 'Vê documentos públicos, de clientes e os liberados para ele.'],
                ['ADMIN', 'Administrador', 'Vê tudo e gerencia documentos, usuários e produtos.'],
              ] as [Perfil, string, string][]
            ).map(([valor, rotulo, descricao]) => (
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

        <section className="form-bloco" aria-labelledby="bloco-senha">
          <div className="form-bloco-titulo">
            <h2 id="bloco-senha">{editando ? 'Redefinir senha' : 'Senha inicial'}</h2>
            <p>
              {editando
                ? 'Deixe em branco para manter a senha atual. Use quando a pessoa esquecer a senha.'
                : 'Envie esta senha para a pessoa; ela pode trocá-la em “Minha conta”.'}
            </p>
          </div>
          <Campo
            id="senha"
            rotulo={editando ? 'Nova senha' : 'Senha'}
            opcional={editando}
            erro={erroDe(editando ? 'novaSenha' : 'senha')}
            ajuda="Pelo menos 8 caracteres, com letras e números."
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
                <button type="button" className="botao botao-secundario" onClick={() => setSenha(gerarSenha())}>
                  <Shuffle aria-hidden /> Gerar senha
                </button>
              </div>
            )}
          </Campo>
        </section>

        {usuario && usuario.documentosLiberados.length > 0 && (
          <section className="form-bloco" aria-labelledby="bloco-liberados">
            <div className="form-bloco-titulo">
              <h2 id="bloco-liberados">Documentos restritos liberados</h2>
              <p>Para tirar o acesso, edite o documento e remova a pessoa da lista.</p>
            </div>
            <ul className="lista-simples">
              {usuario.documentosLiberados.map((documento) => (
                <li key={documento.id}>
                  <Link to={`/admin/documentos/${documento.id}`}>{documento.titulo}</Link>{' '}
                  <span className="texto-suave">({TIPOS[documento.tipo].singular})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="form-rodape">
          <div className="grupo-botoes">
            <button type="submit" className="botao botao-principal" disabled={salvando}>
              {senha && editando ? <KeyRound aria-hidden /> : <Save aria-hidden />}
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar usuário'}
            </button>
            <Link to="/admin/usuarios" className="botao botao-fantasma">
              Cancelar
            </Link>
          </div>
          {usuario && !ehEuMesmo && (
            <button type="button" className="botao botao-perigo" onClick={() => setConfirmandoExclusao(true)}>
              <Trash aria-hidden /> Excluir
            </button>
          )}
        </div>
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
    </>
  );
}
