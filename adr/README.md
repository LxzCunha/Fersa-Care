# Decisões de arquitetura (ADRs)

Cada arquivo registra uma decisão que molda o projeto: o contexto, o que foi decidido, as alternativas e o preço pago. Servem para quem chega entender o "porquê" sem precisar reconstruir a discussão.

| Nº | Decisão | Situação |
|---|---|---|
| [0001](0001-monolito-modular-em-camadas.md) | Monólito modular em camadas, API e site como pacotes independentes | Aceita |
| [0002](0002-regra-unica-de-visibilidade.md) | Uma única regra de visibilidade, aplicada no repositório | Aceita |
| [0003](0003-sessao-jwt-com-estado-no-banco.md) | Sessão em JWT dentro de cookie httpOnly, com versão conferida no banco | Aceita |
| [0004](0004-pgvector-no-proprio-postgres.md) | Busca semântica com pgvector no próprio PostgreSQL | Aceita |
| [0005](0005-ia-local-com-ollama.md) | Modelos de IA locais (Ollama) para o assistente | Aceita |
| [0006](0006-testes-contra-postgres-real.md) | Testes de integração contra um PostgreSQL de verdade | Aceita |
| [0007](0007-auditoria-somente-insercao.md) | Trilha de auditoria somente inserção, com contexto da requisição | Aceita |
| [0008](0008-typescript-7-e-api-do-6-para-o-lint.md) | TypeScript 7 para compilar, TypeScript 6 como API do ESLint | Aceita (provisória) |

Para uma decisão nova: copie o formato de um ADR existente, use o próximo número e adicione a linha acima. Decisão revista não é apagada: o ADR antigo ganha "Substituída por 00NN".
