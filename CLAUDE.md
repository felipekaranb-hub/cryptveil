# CLAUDE.md — Cryptveil

Roguelite por turnos inspirado em Tibia. TypeScript 6 + Phaser 4 + Vite 8 + Vitest 5.
**Leia `docs/HANDOFF.md` inteiro antes de mexer no código** — decisões de design, arquitetura e marcos estão lá. O GDD original se perdeu: o handoff é a fonte única. Lacuna de design → perguntar ao Felipe (2–3 opções + recomendação) e registrar a decisão no handoff.

## Onde estamos (atualizado em 01/10/2026)

- **Entregues:** Marcos 0, 1, 2a (BSP, andares, suspender automático), 2b (Knight: skills, mana, XP, loot, poções, sala de treino), 2c (ajustes de sensação), 2d (level up com cartas) e 3 (UI completa: HUD, paper doll, hotbar com combo LB/RB no controle, inventário com abas Mochila/Pra vender/Deck, minimapa e fog of war). Tudo publicado na `main`.
- **Próximo:** Marco 4 — conteúdo MVP (Rat/Skeleton/Goblin/Orc com loot tables, Merchant Room + loja, Orc Warlord + Boss Room, 2 relíquias). Apresentar o plano antes; stats dos monstros, preços e relíquias ainda são lacunas (§7).
- O que já foi decidido (e por quê) está no `docs/HANDOFF.md` §5 (um bloco por Marco) e §7. Números provisórios: balanceamento final no Marco 6.

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
SIM=100 npx vitest run src/core/sim --silent=false   # simulação headless de balanceamento (~30 s)
```

## Dicas práticas (aprendidas na prática)

- **Mudou número de balanceamento?** Rode a simulação antes e depois e registre o resultado no handoff. É uma régua (bot fixo), não um jogador ótimo.
- **Testar no navegador:** Chromium + Playwright já instalados (`require('/opt/node22/lib/node_modules/playwright')`). Pra pular direto pra uma situação, gere um save pelo core (`serializeRun`) e injete com `page.addInitScript` em `localStorage['cryptveil.run']` antes de abrir a página — `page.reload()` não serve, porque o `visibilitychange` da página antiga salva por cima. Teclas: `keyboard.down` + espera ~50 ms + `up` (o input é lido por frame).
- **Não use `pkill -f "vite ..."` no mesmo comando de outras coisas:** o padrão casa com a própria linha de comando e mata tudo.
- Save da run tem `version` + migração (`core/save/runSave.ts`): mudou o formato do `RunState`, suba a versão e escreva a migração com teste.
- **Testar o controle sem controle:** no `addInitScript`, troque `navigator.getGamepads` por um pad falso (`mapping: 'standard'`, botões 0–3 = A/B/X/Y, 4/5 = LB/RB) e dispare `gamepadconnected`. O `timestamp` do pad tem que ser **maior** que o `performance.now()` da criação, senão o Phaser ignora os botões.
- Debug no navegador (só no dev): `window.__game.scene.getScene('game').state` é o `RunState` vivo; módulos do core dá pra importar com `await import('/src/core/...ts')`.

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
