import { Globe, Lock, UserCheck } from 'lucide-react';

export function NiveisDeAcesso() {
  return (
    <section className="niveis" aria-labelledby="titulo-niveis">
      <h2 id="titulo-niveis">O que você acessa no FERSA Care</h2>
      <ul className="niveis-lista">
        <li>
          <Globe aria-hidden />
          <strong>Sem cadastro</strong>
          <p>Catálogos, fichas técnicas e guias de montagem públicos, além do contato com o suporte.</p>
        </li>
        <li>
          <UserCheck aria-hidden />
          <strong>Clientes cadastrados</strong>
          <p>Tudo o que é público, mais boletins técnicos, treinamentos e vídeos exclusivos.</p>
        </li>
        <li>
          <Lock aria-hidden />
          <strong>Materiais liberados para você</strong>
          <p>Documentos que a equipe FERSA libera para clientes específicos, como condições para distribuidores.</p>
        </li>
      </ul>
    </section>
  );
}
