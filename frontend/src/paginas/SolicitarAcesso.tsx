import { CircleCheck, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { solicitarAcesso, type DadosSolicitacao } from '../api/auth';
import { ErroApi } from '../api/cliente';
import { CampoTexto } from '../componentes/Campo';
import { AvisoErro } from '../componentes/Estados';
import { NiveisDeAcesso } from '../componentes/NiveisDeAcesso';
import './Acesso.css';

const VAZIO: DadosSolicitacao = { nome: '', email: '', empresa: '', telefone: '', senha: '' };

export function SolicitarAcesso() {
  const [dados, setDados] = useState(VAZIO);
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<ErroApi | Error | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  function atualizar(campo: keyof DadosSolicitacao, valor: string) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (dados.senha !== confirmacao) {
      setErro(new ErroApi(400, 'SENHAS_DIFERENTES', 'As senhas não conferem.', [
        { campo: 'confirmacao', mensagem: 'Digite a mesma senha nos dois campos.' },
      ]));
      return;
    }
    setEnviando(true);
    try {
      await solicitarAcesso(dados);
      setEnviado(true);
    } catch (falha) {
      setErro(falha as Error);
    } finally {
      setEnviando(false);
    }
  }

  const erroDe = (campo: string) => (erro instanceof ErroApi ? erro.erroDoCampo(campo) : undefined);

  if (enviado) {
    return (
      <div className="conteiner pagina">
        <title>Solicitação enviada | FERSA Care</title>
        <div className="sucesso" role="status">
          <CircleCheck aria-hidden width={32} height={32} color="var(--ok)" />
          <h1>Solicitação enviada</h1>
          <p>
            A equipe FERSA vai analisar seu cadastro. Assim que for aprovado, você entra com o e-mail{' '}
            <strong>{dados.email}</strong> e a senha que acabou de criar.
          </p>
          <Link to="/" className="botao botao-secundario">
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="conteiner pagina acesso">
      <title>Solicitar acesso | FERSA Care</title>

      <form className="acesso-formulario" onSubmit={aoEnviar} noValidate>
        <div className="campo">
          <h1>Solicitar acesso</h1>
          <p className="campo-ajuda">Para oficinas, distribuidores e clientes FERSA. O acesso é liberado após análise.</p>
        </div>

        {erro && !(erro instanceof ErroApi && erro.detalhes.length > 0) && <AvisoErro erro={erro} />}

        <CampoTexto
          id="nome"
          rotulo="Nome completo"
          autoComplete="name"
          required
          value={dados.nome}
          onChange={(e) => atualizar('nome', e.target.value)}
          erro={erroDe('nome')}
        />
        <CampoTexto
          id="email"
          rotulo="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={dados.email}
          onChange={(e) => atualizar('email', e.target.value)}
          erro={erroDe('email') ?? (erro instanceof ErroApi && erro.status === 409 ? erro.message : undefined)}
        />
        <CampoTexto
          id="empresa"
          rotulo="Empresa"
          opcional
          autoComplete="organization"
          ajuda="Nome da oficina, distribuidora ou empresa."
          value={dados.empresa}
          onChange={(e) => atualizar('empresa', e.target.value)}
          erro={erroDe('empresa')}
        />
        <CampoTexto
          id="telefone"
          rotulo="Telefone ou WhatsApp"
          opcional
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={dados.telefone}
          onChange={(e) => atualizar('telefone', e.target.value)}
          erro={erroDe('telefone')}
        />
        <CampoTexto
          id="senha"
          rotulo="Crie uma senha"
          type="password"
          autoComplete="new-password"
          required
          ajuda="Pelo menos 8 caracteres, com letras e números."
          value={dados.senha}
          onChange={(e) => atualizar('senha', e.target.value)}
          erro={erroDe('senha')}
        />
        <CampoTexto
          id="confirmacao"
          rotulo="Repita a senha"
          type="password"
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          erro={erroDe('confirmacao')}
        />

        <button type="submit" className="botao botao-principal botao-grande botao-bloco" disabled={enviando}>
          <Send aria-hidden />
          {enviando ? 'Enviando...' : 'Enviar solicitação'}
        </button>

        <p className="acesso-rodape">
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>

      <NiveisDeAcesso />
    </div>
  );
}
