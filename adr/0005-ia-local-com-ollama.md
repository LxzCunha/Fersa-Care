# 0005. Modelos de IA locais (Ollama) para o assistente

- **Situação:** aceita
- **Data:** 2026-10

## Contexto

Os documentos incluem material restrito a clientes e as conversas trazem dados de contato. Mandar isso a uma API externa de IA exige contrato, avaliação de LGPD e custo por uso que a FERSA ainda não decidiu assumir.

## Decisão

Embeddings (`bge-m3`) e respostas (`qwen2.5:14b`) rodam no Ollama, no mesmo servidor ou na rede interna. Todo acesso passa por `lib/ia.ts` (`gerarEmbeddings`, `conversar`, `iaDisponivel`), e o resto do código não sabe qual provedor está por trás. Sem o Ollama, a API continua no ar: o assistente responde com uma mensagem fixa e oferece o chamado, e a verificação de prontidão marca o serviço como "degradado".

## Alternativas consideradas

- **API comercial (OpenAI, Anthropic, Google):** respostas melhores e mais rápidas, mas os documentos sairiam da empresa.
- **Modelo menor (7B):** mais rápido; continua possível pela variável `IA_MODELO_CHAT`, a decidir com o conjunto de avaliação.

## Consequências

- Nada sai do servidor; o custo é fixo (hardware).
- Respostas lentas (cerca de 9 tokens/s num Mac M4; 30 a 45 s por resposta), amenizadas pelo streaming.
- Trocar de provedor é reescrever `lib/ia.ts`; prompt, recuperação e escalonamento para chamado não mudam.
- Antes de liberar aos clientes falta um conjunto de avaliação (perguntas reais com o documento esperado).
