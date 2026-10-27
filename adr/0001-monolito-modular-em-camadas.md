# 0001. Monólito modular em camadas, API e site como pacotes independentes

- **Situação:** aceita
- **Data:** 2026-10

## Contexto

Equipe pequena, vinda de Java/Spring, com prazo acadêmico e um domínio simples (documentos, peças, usuários, chamados). O portal precisa rodar num único servidor da FERSA, mas o site e a API têm ciclos de build diferentes (Vite × Node).

## Decisão

- Um repositório com dois pacotes npm independentes, `backend/` e `frontend/`, sem workspace na raiz. Cada um tem seu `package-lock.json`, seus testes e seu lint.
- A API é um monólito em camadas: `routes → controllers → services → repositories → models`. Cada camada só chama a de baixo. São módulos de funções exportadas, sem classes nem contêiner de injeção.
- Regras de negócio ficam nos services, que nunca importam o Drizzle. SQL fica só nos repositories. Transações passam explicitamente (`emTransacao(tx => ...)`).
- Em produção, a própria API entrega o site já compilado (mesma origem, sem CORS), numa única imagem Docker.

## Alternativas consideradas

- **Microsserviços** (catálogo, documentos, assistente): custo operacional sem ganho para um único time e um único banco.
- **Repositórios separados para API e site:** os tipos da API são espelhados à mão no site (`api/tipos.ts`); com repositórios separados, mudanças que tocam os dois viram dois PRs desencontrados.
- **NestJS** (mais parecido com o Spring): mais conceitos (módulos, decorators, DI) para um domínio pequeno.

## Consequências

- Camadas previsíveis: a mesma pergunta ("onde fica a regra X?") tem sempre a mesma resposta.
- Sem workspace, cada pacote instala e testa sozinho, e o CI roda os dois em paralelo.
- Os tipos compartilhados são duplicados de propósito; a lista do que precisa andar junto está no `CLAUDE.md` ("Values duplicated between backend and frontend").
- Para extrair o assistente em um serviço próprio no futuro, a fronteira já existe: `lib/ia.ts` e `services/assistente.service.ts`.
