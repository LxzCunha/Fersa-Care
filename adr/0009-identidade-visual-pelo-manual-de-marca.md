# 0009. Identidade visual pelo manual de marca FERSA 2025

- **Situação:** aceita
- **Data:** 2026-11

## Contexto

A primeira versão do visual seguia o site brasil.fersa.com por observação: um azul-marinho aproximado, Plus Jakarta Sans e o nome "FERSA" escrito em texto no lugar do logotipo. O portal leva a marca da FERSA para clientes e distribuidores, então precisa seguir o *Brandmanual Fersa 2025*, que define logotipo, cores, tipografia e elementos gráficos.

## Decisão

- **Cores:** só as da paleta do manual (Origin, Titanium, Steel, Chrome, Electric, Soul, Power, preto e branco), declaradas uma vez em `tokens.css` com os nomes do manual (`--fersa-origin`...). Tons claros são a própria cor misturada com branco, como a escala de tons do manual. Ficam fora da paleta só o vermelho de erro e o âmbar de atenção: o manual não define cores de estado, e elas precisam ser reconhecíveis e acessíveis.
- **Logotipo e símbolo:** extraídos em vetor do PDF do manual, com os caminhos originais, sem redesenho. Versão Origin para fundo claro e branca para fundo escuro. "Care" entra como complemento depois do separador oficial (o símbolo), com os espaçamentos da página 36.
- **Tipografia:** TT Hoves Pro, a fonte do manual, é comercial. O código a registra sozinho quando os arquivos licenciados são colocados em `src/assets/fontes/`. Enquanto isso, vale a Albert Sans, a alternativa livre mais próxima, escolhida comparando as duas lado a lado. Títulos grandes em Light, como no manual.
- **Elementos gráficos:** o gradiente corporativo (Electric sobre Origin) nas superfícies escuras de destaque e o símbolo como grafismo da página inicial e como favicon.

## Alternativas consideradas

- **Manter a aproximação do site:** mais rápido, mas com cor, fonte e logotipo diferentes dos oficiais.
- **Embutir a TT Hoves Pro sem licença:** violaria a licença da TypeType.
- **Redesenhar o logotipo em SVG:** proibido pelo manual. A extração preserva a geometria original.

## Consequências

- Mudar uma cor da marca é mudar um token. O CSS não tem mais cores soltas fora de `tokens.css`.
- Para ficar 100% fiel ao manual, falta só colocar os arquivos licenciados da TT Hoves Pro (instruções em `src/assets/fontes/LEIA-ME.md`).
- Se o time de design da FERSA fornecer os arquivos exportados do logotipo, eles substituem os extraídos mantendo os nomes.
