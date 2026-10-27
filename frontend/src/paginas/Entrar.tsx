import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ErroApi, mensagemDeErro } from '../api/cliente';
import { NiveisDeAcesso } from '../componentes/NiveisDeAcesso';
import { useAutenticacao } from '../contexto/Autenticacao';
import { useNotificar } from '../contexto/Notificacoes';
import './Acesso.css';

/** Só aceita voltar para caminhos internos do portal (evita redirecionar para outro site). */
function destinoSeguro(valor: string | null): string | null {
  return valor && valor.startsWith('/') && !valor.startsWith('//') ? valor : null;
}

export function Entrar() {
  const { usuario, entrar } = useAutenticacao();
  const notificar = useNotificar();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const voltarPara = destinoSeguro(parametros.get('voltar'));

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; tipo: 'erro' | 'atencao' } | null>(null);

  // Quem já está logado não precisa ver esta tela.
  if (usuario && !enviando) return <Navigate to={voltarPara ?? '/'} replace />;

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const logado = await entrar(email, senha);
      notificar(`Olá, ${logado.nome.split(' ')[0]}!`);
      navegar(voltarPara ?? (logado.perfil === 'ADMIN' ? '/admin' : '/'), { replace: true });
    } catch (falha) {
      const pendente = falha instanceof ErroApi && falha.codigo === 'CADASTRO_PENDENTE';
      setErro({ mensagem: mensagemDeErro(falha), tipo: pendente ? 'atencao' : 'erro' });
      setEnviando(false);
    }
  }

  return (
    <div className="conteiner pagina acesso">
      <title>Entrar | FERSA Care</title>

      <form className="acesso-formulario" onSubmit={aoEnviar} noValidate>
        <h1>Entrar</h1>

        {erro && (
          <div className={`aviso aviso-${erro.tipo}`} role="alert">
            {erro.mensagem}
          </div>
        )}

        <div className="campo">
          <label className="campo-rotulo" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            className="entrada"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
          />
        </div>

        <div className="campo">
          <label className="campo-rotulo" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            className="entrada"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </div>

        <button type="submit" className="botao botao-principal botao-grande botao-bloco" disabled={enviando}>
          <LogIn aria-hidden />
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="acesso-rodape">
          Ainda não tem acesso? <Link to="/solicitar-acesso">Solicitar acesso</Link>
          <br />
          Esqueceu a senha? Fale com o suporte para redefinir.
        </p>
      </form>

      <NiveisDeAcesso />
    </div>
  );
}
