# 0008. TypeScript 7 para compilar, TypeScript 6 como API do ESLint

- **Situação:** aceita (provisória)
- **Data:** 2026-10

## Contexto

O projeto usa o TypeScript 7 (compilador nativo, bem mais rápido). Ele ainda não oferece a API em JavaScript que o `typescript-eslint` usa para ler os tipos, e as regras que mais pegam bugs (`no-floating-promises`, `no-misused-promises`) dependem dessas informações.

## Decisão

Nos dois pacotes:

```json
"typescript": "npm:@typescript/typescript6@^6.0.2",
"@typescript/native": "npm:typescript@^7.0.2"
```

O comando `tsc` (build, `typecheck` e Dockerfile) continua sendo o 7, que vem do pacote `@typescript/native`. Quem faz `import 'typescript'` (o ESLint) recebe a API do 6, publicada pela própria Microsoft para essa transição.

## Alternativas consideradas

- **Voltar ao TypeScript 6:** perde a velocidade do 7 sem necessidade.
- **Lint sem informação de tipos:** perde justamente as regras de Promise.
- **Trocar o ESLint pelo oxlint:** promissor, mas a cobertura de regras com tipos ainda é menor.

## Consequências

- Editores configurados para usar o TypeScript do projeto usam o 6 (diferenças mínimas no dia a dia).
- Quando o `typescript-eslint` suportar o 7, basta remover os dois apelidos e voltar a `"typescript": "^7"`. O Dependabot avisa das versões novas.
