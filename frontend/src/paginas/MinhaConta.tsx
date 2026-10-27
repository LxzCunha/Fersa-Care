import { KeyRound, LayoutDashboard, LogOut, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { atualizarPerfil, trocarSenha } from '../api/auth';
import { ErroApi } from '../api/cliente';
import { CampoTexto } from '../componentes/Campo';
import { AvisoErro } from '../componentes/Estados';
import { useAutenticacao } from '../contexto/Autenticacao';
import { useNotificar } from '../contexto/Notificacoes';
import { PERFIS } from '../lib/rotulos';
import './Acesso.css';

export function MinhaConta() {
  const { usuario, ehAdmin, atualizarUsuario, sair } = useAutenticacao();
  const notificar = useNotificar();
  const navegar = useNavigate();

  const [perfil, setPerfil] = useState({
    nome: usuario?.nome ?? '',
    empresa: usuario?.empresa ?? '',
    telefone: usuario?.telefone ?? '',
  });
  const [erroPerfil, setErroPerfil] = useState<unknown>(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmacao: '' });
  const [erroSenha, setErroSenha] = useState<unknown>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  if (!usuario) return null;

  async function salvarPerfil(evento: FormEvent) {
    evento.preventDefault();
    setErroPerfil(null);
    setSalvandoPerfil(true);
    try {
      atualizarUsuario(await atualizarPerfil(perfil));
      notificar('Dados atualizados.');
    } catch (falha) {
      setErroPerfil(falha);
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function salvarSenha(evento: FormEvent) {
    evento.preventDefault();
    setErroSenha(null);
    if (senhas.nova !== senhas.confirmacao) {
      setErroSenha(
        new ErroApi(400, 'SENHAS_DIFERENTES', 'As senhas não conferem.', [
          { campo: 'confirmacao', mensagem: 'Digite a mesma senha nos dois campos.' },
        ]),
      );
      return;
    }
    setSalvandoSenha(true);
    try {
      await trocarSenha(senhas.atual, senhas.nova);
      setSenhas({ atual: '', nova: '', confirmacao: '' });
      notificar('Senha alterada.');
    } catch (falha) {
      setErroSenha(falha);
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function aoSair() {
    await sair();
    notificar('Você saiu da sua conta.');
    navegar('/');
  }

  const erroCampoPerfil = (campo: string) => (erroPerfil instanceof ErroApi ? erroPerfil.erroDoCampo(campo) : undefined);
  const erroCampoSenha = (campo: string) => (erroSenha instanceof ErroApi ? erroSenha.erroDoCampo(campo) : undefined);

  return (
    <div className="conteiner pagina">
      <title>Minha conta | FERSA Care</title>

      <header className="pagina-cabecalho">
        <div className="pagina-cabecalho-linha">
          <h1>Minha conta</h1>
          <div className="grupo-botoes">
            {ehAdmin && (
              <Link to="/admin" className="botao botao-escuro">
                <LayoutDashboard aria-hidden /> Administração
              </Link>
            )}
            <button type="button" className="botao botao-secundario" onClick={aoSair}>
              <LogOut aria-hidden /> Sair
            </button>
          </div>
        </div>
        <p className="conta-identidade">
          <span>{usuario.email}</span>
          <span className={`selo ${ehAdmin ? 'selo-admin' : 'selo-ativo'}`}>{PERFIS[usuario.perfil]}</span>
        </p>
      </header>

      <div className="conta-grade">
        <form className="acesso-formulario" onSubmit={salvarPerfil} noValidate>
          <h2>Seus dados</h2>
          {Boolean(erroPerfil) && !(erroPerfil instanceof ErroApi && erroPerfil.detalhes.length) && (
            <AvisoErro erro={erroPerfil} />
          )}
          <CampoTexto
            id="nome"
            rotulo="Nome completo"
            autoComplete="name"
            value={perfil.nome}
            onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
            erro={erroCampoPerfil('nome')}
          />
          <CampoTexto
            id="empresa"
            rotulo="Empresa"
            opcional
            autoComplete="organization"
            value={perfil.empresa}
            onChange={(e) => setPerfil({ ...perfil, empresa: e.target.value })}
            erro={erroCampoPerfil('empresa')}
          />
          <CampoTexto
            id="telefone"
            rotulo="Telefone ou WhatsApp"
            opcional
            type="tel"
            autoComplete="tel"
            value={perfil.telefone}
            onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })}
            erro={erroCampoPerfil('telefone')}
          />
          <p className="campo-ajuda">Para trocar o e-mail, fale com o suporte FERSA.</p>
          <button type="submit" className="botao botao-principal" disabled={salvandoPerfil}>
            <Save aria-hidden /> {salvandoPerfil ? 'Salvando...' : 'Salvar dados'}
          </button>
        </form>

        <form className="acesso-formulario" onSubmit={salvarSenha} noValidate>
          <h2>Trocar senha</h2>
          {Boolean(erroSenha) && !(erroSenha instanceof ErroApi && erroSenha.detalhes.length) && (
            <AvisoErro erro={erroSenha} />
          )}
          <CampoTexto
            id="senha-atual"
            rotulo="Senha atual"
            type="password"
            autoComplete="current-password"
            value={senhas.atual}
            onChange={(e) => setSenhas({ ...senhas, atual: e.target.value })}
            erro={erroCampoSenha('senhaAtual')}
          />
          <CampoTexto
            id="senha-nova"
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            ajuda="Pelo menos 8 caracteres, com letras e números."
            value={senhas.nova}
            onChange={(e) => setSenhas({ ...senhas, nova: e.target.value })}
            erro={erroCampoSenha('novaSenha')}
          />
          <CampoTexto
            id="senha-confirmacao"
            rotulo="Repita a nova senha"
            type="password"
            autoComplete="new-password"
            value={senhas.confirmacao}
            onChange={(e) => setSenhas({ ...senhas, confirmacao: e.target.value })}
            erro={erroCampoSenha('confirmacao')}
          />
          <button type="submit" className="botao botao-secundario" disabled={salvandoSenha}>
            <KeyRound aria-hidden /> {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
