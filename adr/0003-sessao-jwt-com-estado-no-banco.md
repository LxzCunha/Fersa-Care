# 0003. Sessão em JWT dentro de cookie httpOnly, com versão conferida no banco

- **Situação:** aceita
- **Data:** 2026-10

## Contexto

O site e a API ficam na mesma origem; um app nativo pode vir depois. Desativar um cliente precisa valer na hora, e trocar a senha precisa derrubar sessões roubadas. JWT "puro" não permite revogar; sessão em tabela exige uma consulta extra por requisição e limpeza de sessões vencidas.

## Decisão

- O token é um JWT HS256 com só o id do usuário e a **versão da sessão** (`ver`), além de emissor, público e validade.
- No navegador, ele vai num cookie `httpOnly`, `SameSite=Lax` e `Secure` em HTTPS; apps podem usar `Authorization: Bearer`.
- A cada requisição, a API carrega o usuário do banco (que ela já precisaria para saber perfil e situação) e confere `usuarios.versao_sessao`. Somar 1 a essa coluna derruba todos os tokens da conta: isso acontece na troca e na redefinição de senha, na desativação e em "sair dos outros dispositivos".
- Defesa contra CSRF em duas camadas: `SameSite=Lax` e conferência de `Origin`/`Sec-Fetch-Site` nas requisições que alteram dados.

## Alternativas consideradas

- **Tabela de sessões** (um id opaco por login): permite listar e encerrar sessões uma a uma, ao custo de mais uma tabela e de uma rotina de limpeza.
- **JWT sem consulta ao banco:** mais rápido, mas a conta desativada continuaria entrando até o token vencer.
- **Token no `localStorage`:** qualquer XSS levaria o token.

## Consequências

- Uma consulta por requisição, pela chave primária, que já existia.
- Revogação é por conta, não por dispositivo: sair num aparelho apaga o cookie, mas um token copiado vale até vencer (8 h). Registrado nos riscos conhecidos, na seção Segurança do README.
- Se surgir a necessidade de listar dispositivos, a evolução natural é a tabela de sessões, mantendo o mesmo cookie.
