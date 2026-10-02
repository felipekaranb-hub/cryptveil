# CLAUDE.md — Cryptveil

Roguelite por turnos inspirado em Tibia. TypeScript 6 + Phaser 4 + Vite 8 + Vitest 5.
**Leia `docs/HANDOFF.md` inteiro antes de mexer no código** — decisões de design, arquitetura e marcos estão lá. O GDD original se perdeu: o handoff é a fonte única. Lacuna de design → perguntar ao Felipe (2–3 opções + recomendação) e registrar a decisão no handoff.

## Onde estamos (atualizado em 02/10/2026)

- **MVP completo e validado pelo Felipe** ("dificuldade satisfatória, o jogo está divertido"). Tudo publicado na `main` e no GitHub Pages.
- **Entregues:** Marcos 0, 1, 2a–2d (andares, Knight, cartas), 3 (UI completa), 4 (monstros reais, mercador e loja, Orc Warlord, 4 relíquias), 5 (Sanctum com The Vault, Ancient Armory e Tome of Knowledge, resumo do fim da run, MetaProgress, bestiário), 6a (DEF em porcentagem, ATK do Knight 8), 6b (sprites Kenney Tiny Dungeon + próprios, movimento animado, fonte VT323, sons sintetizados, mudo M/Select) e o **ajuste pós-6b de dificuldade** (level up não enche a mana, 3 de mana por kill, recarga nas skills — Berserk 3, Whirlwind 2, Wound Cleansing 5 —, Orc Warlord com 750 de HP invocando a cada 2 turnos; `RunState` v8). Detalhes e números da simulação no `docs/HANDOFF.md` §5.
- **Próximo: escolher o primeiro bloco do pós-MVP.** Opções apresentadas ao Felipe em 02/10/2026 (ele ainda não escolheu):
  - **A) Região 2 — andares 6–10** (recomendada): 3–4 monstros novos (Dragon, Lich, Vampire, Ghost), boss no andar 10, itens tier 2, estoque novo no mercador. Reaproveita região/boss/mercador; balancear antes das classes evita rebalancear tudo por classe.
  - **B) Sorcerer** (§2.1: staff alcance 3, ataque mágico ignora DEF): skills, cartas e Shrine of Vocations no Sanctum. Mais variedade, mais balanceamento.
  - **C) Modo fliperama**: tela de atração + ranking de 3 iniciais. Melhor quando o bartop existir (o Felipe ainda não comprou).
  - **D) Música**: o Felipe vai arrumar uma; encaixar com volume próprio e o mesmo mudo. Pequeno, combina com qualquer outro.
  - Escolhido o bloco: **apresentar o plano** (arquivos, números, lacunas em 2–3 opções + recomendação) e esperar o OK antes de codar.
- **Pendências conhecidas** (handoff §7): sprites que faltam (ícones das skills na hotbar, monstros novos — desenhar no estilo do Tiny Dungeon, ver "Sprites" abaixo); custo do Sanctum (2.490g) talvez longo demais; pacote de sprites local opcional só pro fliperama.
- **Rede do ambiente:** está em "Completo" (o Felipe liberou pro `kenney.nl`). Recomendação registrada: voltar pra "Personalizado" só com os domínios necessários. Antes de pedir um domínio novo, explicar o que é e por quê.

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
- Save da run tem `version` + migração (`core/save/runSave.ts`): mudou o formato do `RunState`, suba a versão e escreva a migração com teste. A meta (`cryptveil.meta`, `core/meta/metaProgress.ts`) tem o mesmo esquema.
- **O jogo abre no Sanctum** (`HubScene`), não no mapa. Teste no navegador: Enter em "Descer à cripta" (ou injete o save e entre em "Continuar run"); `?seed=` vai direto pro mapa. Pra testar compra, injete `localStorage['cryptveil.meta']` com gold.
- **Testar o controle sem controle:** no `addInitScript`, troque `navigator.getGamepads` por um pad falso (`mapping: 'standard'`, botões 0–3 = A/B/X/Y, 4/5 = LB/RB) e dispare `gamepadconnected`. O `timestamp` do pad tem que ser **maior** que o `performance.now()` da criação, senão o Phaser ignora os botões.
- **Andar do boss (5):** não existe escada até o Orc Warlord morrer (`state.hiddenStairs` marca o andar; a escada nasce onde ele cai). Helper de teste ou bot que "anda até a escada" tem que mirar no boss enquanto ele vive, e escolher a carta do level up que o kill dele abre.
- **Bot de teste no navegador "travado" quase sempre é o bot**, não o jogo: monstro parado num corredor de 1 tile bloqueia o caminho "livre", ou um prompt (carta/loja) ficou aberto. Antes de caçar bug, leia `state.status`, `state.prompt` e `scene.mode`.
- **Sprites:** atlas único em `public/assets/sprites/atlas.png`, montado por `python3 tools/sprites/build_atlas.py` (precisa de Pillow: `pip install pillow`). Sprite novo = desenhar no script (16 px, paleta do Tiny Dungeon), rodar e mapear em `src/config/sprites.ts`. Não colocar sprites do Tibia nem de outro jogo com direitos no repositório (é público).
- Script de Playwright rodado com `node` a partir da pasta do projeto salva screenshot com caminho relativo **dentro do repositório**: use `__dirname` + scratchpad.
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
