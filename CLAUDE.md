# CLAUDE.md — Cryptveil

Roguelite por turnos inspirado em Tibia. TypeScript 6 + Phaser 4 + Vite 8 + Vitest 5.
**Leia `docs/HANDOFF.md` inteiro antes de mexer no código** — decisões de design, arquitetura e marcos estão lá. O GDD original se perdeu: o handoff é a fonte única. Lacuna de design → perguntar ao Felipe (2–3 opções + recomendação) e registrar a decisão no handoff.

## Vocabulário (não confundir)

**Sala** (dentro do andar) → **Andar** (entre duas escadas) → **Região** (conjunto de andares, boss no último) → **Run**. Detalhes em `docs/HANDOFF.md` §0.1.

## Como trabalhar

- Responder em **português (Brasil)**. Direto, prático, trade-offs honestos.
- **Antes de cada Marco ou mudança grande:** apresentar o plano (arquivos, mini-decisões, trade-offs) e esperar o OK do Felipe.
- Decisão que o handoff não cobre: 2–3 opções + recomendação. Não inventar.
- O Felipe valida cada Marco rodando local. Não declarar Marco pronto sem `npm run check` verde.
- Um commit (ou PR) por Marco, mensagem em português.
- **Publicar ao fechar um Marco** (autorizado pelo Felipe em 01/10/2026): com `npm run check` verde, levar os commits pra `main` (fast-forward a partir da branch da sessão, sem force push) e conferir que o workflow "Deploy no GitHub Pages" terminou com sucesso. O Felipe valida pelo link https://felipekaranb-hub.github.io/cryptveil/, sem revisar PR. Publicar só Marco fechado, não trabalho pela metade.

## Comandos

```bash
npm install
npm run dev        # localhost:3000
npm run check      # typecheck + testes — obrigatório antes de commitar
npm run build      # build estático em dist/
```

## Regras de arquitetura (verificadas por teste)

- `src/core/` é lógica pura: **sem import de Phaser, sem DOM, sem `Math.random()`** (use `Rng`). O `src/core/architecture.test.ts` quebra se alguém violar.
- Estado da run é serializável em JSON. O core emite eventos; a view anima e o BattleLog lista.
- Jogador → `Action` (`src/core/actions.ts`). Nada no core sabe de tecla ou botão.
- Constantes de balanceamento só em `src/core/balance.ts`. Visual em `src/config/display.ts`.
- Dados de jogo em `.ts` com `satisfies`, não `.json`.

## Convenções

- Identificadores em inglês; comentários em português quando explicam decisão de design.
- Discriminated unions pra resultados de ação.
- IA de inimigo como estratégia injetada.
- Phaser 4 é recente e muito tutorial online é v3: consultar `node_modules/phaser/skills/<subsistema>/SKILL.md` (e `v3-to-v4-migration`) antes de usar uma API nova.
