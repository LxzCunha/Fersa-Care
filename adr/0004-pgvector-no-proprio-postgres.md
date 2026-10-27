# 0004. Busca semântica com pgvector no próprio PostgreSQL

- **Situação:** aceita
- **Data:** 2026-10

## Contexto

O assistente precisa encontrar trechos de documentos parecidos com a pergunta (RAG) e, ao mesmo tempo, respeitar quem pode ver cada documento (ADR 0002). O volume é de centenas a poucos milhares de documentos.

## Decisão

Os trechos e seus embeddings (`vector(1024)`, modelo bge-m3) ficam na tabela `documento_trechos`, com índice HNSW por distância de cosseno. A busca é um `SELECT` com `JOIN` em `documentos` e a mesma `condicaoDeVisibilidade`. Trechos com distância acima de 0,62 são descartados (calibrado: assuntos do portal ≤ 0,58, fora do assunto ≥ 0,72).

## Alternativas consideradas

- **Banco vetorial dedicado** (Qdrant, Pinecone, Weaviate): mais um serviço para operar, e a regra de acesso teria de ser replicada como filtros de metadados, sincronizados a cada mudança de permissão.
- **Só busca textual (tsvector):** já existe para a biblioteca, mas não entende sinônimos nem perguntas em linguagem natural.

## Consequências

- Permissão e busca na mesma consulta, na mesma transação: liberar ou retirar acesso vale na hora para o assistente.
- Um banco só para backup, migração e testes. O CI usa a imagem `pgvector/pgvector:pg17`.
- Trocar de modelo de embedding com outra dimensão exige migração e reindexação completa (`npm run ia:indexar -- --todos`).
