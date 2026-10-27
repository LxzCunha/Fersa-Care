# 0002. Uma única regra de visibilidade, aplicada no repositório

- **Situação:** aceita
- **Data:** 2026-10

## Contexto

Documentos têm quatro níveis (`PUBLICO`, `AUTENTICADO`, `RESTRITO` com lista de pessoas, e rascunho) e aparecem em muitos lugares: lista, detalhe, download, capa, contagens, página da peça, busca geral e, depois, a busca do assistente (RAG). Cada lugar com a sua própria checagem é um IDOR esperando para acontecer.

## Decisão

`repositories/visibilidade.ts` exporta `condicaoDeVisibilidade(usuario, { incluirRascunhos })`, que devolve a condição SQL do que aquela pessoa pode ver. Toda consulta que devolve documentos usa essa função, inclusive a busca vetorial do assistente. Services não montam regra de acesso: passam o `usuario` da requisição ao repository.

Quem não pode ver recebe 404 (ou 401, se fazer login resolveria), nunca 403: a API não confirma que o documento existe.

## Alternativas consideradas

- **Checar no service depois de buscar:** fácil de esquecer num endpoint novo e não funciona para listas paginadas (a página viria com buracos e o total errado).
- **Row Level Security do PostgreSQL:** defesa forte, mas exige passar o usuário para a sessão do banco em toda conexão do pool e complica os testes. Fica como evolução possível.

## Consequências

- A regra vale igual para lista, contagem e detalhe: os números da tela nunca revelam documentos escondidos.
- `tests/acesso-documentos.test.ts` cobre a matriz ator × visibilidade × endpoint, e `tests/assistente.test.ts` repete a matriz para a busca do assistente.
- Endpoint novo que devolve documentos precisa usar a função; o padrão das camadas torna isso o caminho natural.
