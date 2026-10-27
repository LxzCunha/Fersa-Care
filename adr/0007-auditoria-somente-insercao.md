# 0007. Trilha de auditoria somente inserção, com contexto da requisição

- **Situação:** aceita
- **Data:** 2026-10

## Contexto

Depois de um incidente, a pergunta é sempre a mesma: quem liberou este documento, quem desativou aquela conta, de qual IP vieram as tentativas de login. Logs de aplicação ajudam, mas são rotacionados e difíceis de consultar por quem administra o portal.

## Decisão

- Tabela `auditoria` com ação, autor (id e nome no momento), alvo (tipo, id e rótulo no momento), detalhes em JSON (campos alterados, situação de/para, acesso liberado ou retirado, motivo de recusa), IP e id da requisição.
- Somente inserção: um gatilho no banco recusa `UPDATE` e `DELETE`. Por isso não há chave estrangeira para `usuarios` (excluir uma conta mudaria eventos antigos).
- Os services chamam `registrarEvento({ acao, alvo, detalhes })`. Autor, IP e id da requisição vêm de um contexto aberto no início de cada requisição com `AsyncLocalStorage` (o equivalente ao `SecurityContextHolder`/MDC do Spring), que também alimenta os logs.
- Quando a alteração usa transação (documentos), o evento entra na mesma transação: ou os dois são gravados, ou nenhum.
- Detalhes guardam **o que** mudou, nunca os valores de senha.

## Alternativas consideradas

- **Gatilhos de banco gerando a auditoria:** pegam tudo, mas não sabem quem é o usuário da aplicação nem o IP.
- **Só logs:** não há tela para o admin e a retenção depende da infraestrutura.
- **Passar autor e IP como parâmetro em toda função:** explícito, mas mudaria a assinatura de dezenas de funções só para isso.

## Consequências

- O admin consulta a trilha em **Segurança → Auditoria**, com filtros e busca.
- Ação nova que mereça registro: adicionar em `ACOES_DE_AUDITORIA` (model), no rótulo do site e chamar `registrarEvento` no service.
- O gatilho protege contra erros da aplicação, não contra quem tem acesso de dono ao banco; para isso, papel separado ou cópia externa (os logs já levam cada evento). Registrado nos riscos conhecidos, na seção Segurança do README.
