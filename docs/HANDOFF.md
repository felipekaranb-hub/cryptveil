# 🗡️ CRYPTVEIL — Handoff v2

Atualizado em 01/10/2026. **Substitui o handoff v1.** Onde o `GAME_BRIEFING.md` (GDD v1.0) divergir deste documento, este documento vence.

---

## 0. Como trabalhar neste projeto

- **Idioma:** português (Brasil). Identificadores de código em inglês; comentários em português quando explicam decisão de design.
- **Postura:** dev sênior de jogos web, direto e prático, com trade-offs honestos em vez de otimismo.
- **Confirmação antes de operações grandes:** antes de cada Marco, apresentar o plano (arquivos, mini-decisões, trade-offs) e esperar o OK.
- **Validação visual por Marco:** o Felipe roda e confirma ("rodou OK" ou screenshot) antes de avançar.
- **Decisão não prevista aqui:** perguntar com 2–3 opções e uma recomendação. Não inventar.
- **Antes de entregar qualquer coisa:** `npm run check` (typecheck + testes) tem que passar.

---

## 1. O jogo em uma frase

Roguelite por turnos no navegador, inspirado em Tibia: Knight desce 5 andares gerados por BSP, mata monstros, junta loot, enfrenta o Orc Warlord no andar 5; o que sobra de gold vira meta-progressão no Sanctum.

O GDD completo é o `GAME_BRIEFING.md` (v1.0, 557 linhas) — **ainda não está no repositório**. Precisa estar antes do Marco 2 (loot tables, relíquias, Sanctum vivem lá). Salvar em `docs/GAME_BRIEFING.md`.

---

## 2. Decisões de design (fechadas)

Herdadas do v1, sem mudança. **Não re-perguntar.**

| # | Tema | Decisão |
|---|---|---|
| 2.1 | Sorcerer | Staff alcance 3; ataque básico é mágico e ignora shield/defesa pesada. Pós-MVP. |
| 2.2 | Boss do Floor 5 | **Orc Warlord** (HP ~500, dano 18–30 → ATK 24, convoca 1 Orc a cada 3 turnos, enraged <30% HP = +50% dano). Drops: Crown Helmet OU Magic Sword; sempre Tower Shield; ~50g. Dragon Lord fica pro v1.1. |
| 2.3 | Monstros do MVP | **Rat, Skeleton, Goblin, Orc.** Dragon volta no v1.1. |
| 2.4 | Equipamento do Knight | Começa com Sword. Tabela abaixo. |
| 2.5 | Itens | `equipTags: Vocation[]`. Drop universal, equip restrito (`canEquip` aceita a vocação ou `'ALL'`). Fora da vocação → aba "Pra vender". |
| 2.6 | Stats | Só **ATK** e **DEF**. Skills usam o mesmo ATK. |
| 2.7 | Training Room | A cada 5 salas exploradas, o próximo andar gera 1 Training Room: escolha única +2 ATK ou +2 DEF. Não persiste entre runs. Level up dá só +10 HP max e +10 Mana max. |
| 2.8 | Slots | Paper doll de 8 (Helmet, Amulet, Armor, Ring, Weapon, Shield, Legs, Boots) + 3 de relíquia. |
| 2.9 | Flags especiais | Minotaur: 1 ação/turno. Vampire: cura 50% do dano causado. Ghost: `ignoresWalls` no pathfinding, mas não termina movimento em parede. |
| 2.10 | Ações | Bater em parede não gasta turno. Bump ataca só o tile da direção. Berserk ataca os 4 adjacentes. |
| 2.11 | Tile | **32×32** na tela. Não revisitar no MVP. |

| Slot | Início | Intermediário | Final (boss) |
|---|---|---|---|
| Weapon | Sword | Spike Sword (Orc 18%) | Magic Sword (Warlord 50%) |
| Armor | — | Leather (Goblin 30%) → Chain (Orc 15%) | Plate (Warlord 40%) |
| Helmet | — | Iron (Skeleton 25%) → Knight (Orc 10%) | Crown (Warlord 50%) |
| Shield | — | Wood (Goblin 18%) → Tower (Orc 8%) | Demon (Warlord 25%) |

### 2.12 Fórmula de dano — **MUDOU no v2**

```
rolagem = sorteio inteiro em [round(ATK × 0,75), round(ATK × 1,25)]
dano    = max(1, rolagem − DEF)
```

Por quê: a fórmula fixa do v1 (`max(1, ATK − DEF)`) não produzia a faixa "18–30" do boss, e é o sabor do Tibia. Implementada em `src/core/combat/damage.ts`, constantes em `src/core/balance.ts`, testada.
**Risco conhecido:** com 4 slots de defesa + Training Room, a DEF do Knight pode passar o ATK dos monstros Tier 1 lá pelo Floor 3 (todo mundo dá 1 de dano). Vigiar no Marco 4; ajustar no Marco 6 (curva de ATK dos monstros ou redução percentual).

---

## 3. Stack (atualizada em out/2026)

| Camada | Decisão |
|---|---|
| Engine | **Phaser 4.2.x** (WebGL/Canvas auto). O Phaser 3 parou na 3.90. |
| Linguagem | **TypeScript 6.0.x** (strict + extras, ver `tsconfig.json`). TS 7 nativo existe, mas sem API programática; subir quando o ecossistema acompanhar. |
| Build | **Vite 8.x** (Rolldown) |
| Testes | **Vitest 5.x**, só no `src/core/` |
| Persistência | LocalStorage, com campo `version` no save e migração |
| Mapas | BSP próprio em TS |
| Assets | Kenney.nl (CC0) no Marco 6. Muitos packs são 16px: desenhar a 2× dentro do tile de 32 é ok. |
| Backend | Nenhum. Build estático (`base: './'`), roda em qualquer hospedagem ou num mini PC de fliperama. |

O pacote do Phaser 4 traz skills de IA em `node_modules/phaser/skills/` (uma por subsistema + guia de migração v3→v4). Consultar antes de usar uma API do Phaser que não esteja no código ainda — muito tutorial da internet é v3.

---

## 4. Arquitetura (nova no v2)

### 4.1 Core separado da view

- **`src/core/`** — lógica pura: mapa, entidades, turnos, combate, loot, save. **Não importa Phaser, não toca DOM, não chama `Math.random()`.** O estado inteiro da run é um objeto serializável em JSON.
- **View (`src/scenes/`, `src/view/`, `src/input/`)** — Phaser lê o estado do core e desenha.
- O core **emite eventos** (`moved`, `attacked`, `died`, `dropped`...). A view anima a fila de eventos; o BattleLog lista os mesmos eventos. O TurnManager continua síncrono e quem espera animação é só a view.

Essa regra é **verificada por teste** (`src/core/architecture.test.ts`): importar Phaser ou usar `Math.random()` dentro de `core/` quebra o `npm test`.

Ganhos: save/load quase de graça, testes sem navegador, simulação de balanceamento headless (Marco 6: rodar mil combates e olhar médias).

### 4.2 RNG com seed

Toda aleatoriedade passa por `Rng` (`src/core/rng.ts`, sfc32). O estado do RNG entra no save. `?seed=48213` na URL reproduz uma run — bug report vira "seed X, andar Y".

### 4.3 Input como ações

O core recebe `Action` (`src/core/actions.ts`), nunca tecla. `InputController` traduz teclado e controle (gamepad API). Isso existe por causa do **fliperama do Cryptveil** (bartop com placa zero delay = controle USB): o jogo precisa funcionar 100% sem teclado/mouse antes de comprar peça.

| Ação | Teclado | Controle |
|---|---|---|
| Mover / atacar (bump) | WASD / Setas | D-pad / analógico esquerdo |
| Passar o turno | Espaço | X |
| Skills 1–8 | 1–8 | **a decidir no Marco 3** (ex.: LB/RB + botões) |
| Inventário | I | Y |
| Confirmar (e nova run no fim) | Enter | A |
| Cancelar | Esc | B |

Repetição de movimento: 130 ms (constantes no `InputController`). **Toque na tela fica pós-MVP.**

### 4.4 Tela

- Resolução **lógica** 960×540 (16:9): todo o código usa essas coordenadas. O canvas é desenhado na resolução **física** da tela (considera `devicePixelRatio`, ou seja, escala do Windows em 125%/150% e telas retina), então texto e bordas saem nítidos. Ver `src/view/scaling.ts`.
- `renderScale` = pixels físicos por pixel lógico: inteiro quando ≥ 2 (pixel art uniforme), fracionário abaixo disso pra preencher a tela. As câmeras usam `layoutCamera()` e os textos ganham `setResolution(scale)` via `bindRenderScale()`. **Texto criado depois do `create()` precisa de `setResolution(getRenderScale())`.**
- Mapa numa câmera própria com viewport de **15×11 tiles (480×352)**, centralizado. A partir do Marco 2 ela segue o player com `setBounds`.
- HUD na **`UIScene`**, em paralelo, com câmera fixa. GameScene e UIScene conversam por eventos tipados (`src/view/events.ts`), nunca por referência direta.
- Celular em pé fica minúsculo (o jogo é paisagem). Aceito no MVP.

### 4.5 Dados

Monstros, itens, relíquias e skills em **`.ts` com `satisfies`**, não `.json`: id digitado errado numa loot table vira erro de compilação.

### 4.6 Save

- **Meta-progressão** (gold, upgrades, bestiário): LocalStorage, Marco 5, com `version` + migração.
- **Run em andamento — MUDOU no v2:** "suspender automático". Salvar a run ao trocar de andar e quando a aba for escondida (`visibilitychange`); ao abrir, oferecer "Continuar". Morte apaga o save (continua roguelite). Entra no Marco 2, junto com a transição de andar. Motivo: navegador de celular mata aba em segundo plano e fechar a aba não pode custar a run.

### 4.7 Pastas

```
cryptveil/
├── CLAUDE.md                  # Instruções curtas pro Claude Code
├── docs/HANDOFF.md            # Este documento
├── docs/GAME_BRIEFING.md      # GDD (falta adicionar)
├── index.html
├── package.json · tsconfig.json · vite.config.ts
└── src/
    ├── main.ts                # Config do Phaser + escala
    ├── config/display.ts      # Tile, viewport, resolução, cores, chaves de cena
    ├── core/                  # LÓGICA PURA (sem Phaser)
    │   ├── actions.ts         # Action (intenções do jogador)
    │   ├── balance.ts         # Números de balanceamento
    │   ├── grid.ts            # Point, Direction, step, manhattan, neighbors4
    │   ├── rng.ts             # Rng com seed
    │   ├── combat/damage.ts   # Fórmula de dano
    │   ├── events.ts          # CoreEvent (moved, attacked, died, waited, victory, defeat)
    │   ├── pathfinding.ts     # BFS 4-direções (bfsFirstStep)
    │   ├── run.ts             # RunState serializável + createTestRun + consultas
    │   ├── ai/strategies.ts   # AiStrategy, chase, registro AI_STRATEGIES (injetado por id)
    │   ├── data/entities.ts   # Modelos (knight, goblinDummy) com satisfies
    │   ├── dungeon/           # DungeonMap + TileType — (M2) DungeonGenerator BSP, Room
    │   ├── entities/Entity.ts # Entidade como dado puro
    │   ├── turn/TurnManager.ts# resolvePlayerAction → TurnResult + eventos
    │   ├── (M2) items/        # Item, Inventory, LootTable
    │   ├── (M2) run/          # RunState serializável + save da run
    │   ├── (M5) meta/         # MetaProgress, Sanctum, Bestiary
    │   └── (M2+) data/        # enemies.ts, items.ts, relics.ts, skills.ts
    ├── input/InputController.ts
    ├── scenes/                # BootScene, GameScene (mundo), UIScene (HUD), (M5) HubScene, GameOverScene
    └── view/                  # coords (tile↔pixel), scaling, events, (M1+) renderers de entidade
```

---

## 5. Marcos

Princípio mantido: **vertical slice primeiro**; cada marco termina jogável e testado.

### ✅ Marco 0 — Setup base (entregue em 01/10/2026)
Stack nova, core/view, escala inteira, câmera do mapa + UIScene, `InputController` (teclado + controle), `Rng`, fórmula de dano, 25 testes (incluindo a guarda de arquitetura). Tela: título, seed, grid 15×11 em xadrez, cantos marcados, clique mostra o tile, quadrado vermelho anda com WASD/D-pad, painel LOG mostra as últimas ações.
**Validação:** `npm install && npm run dev` → `localhost:3000`.

### ✅ Marco 1 — Vertical slice (entregue em 01/10/2026)
Core: `DungeonMap` (sala fixa 15×11), `Entity` como dado, `TurnManager` (`resolvePlayerAction` muta o `RunState` e devolve eventos), IA `chase` por BFS injetada por id, bump attack com `rollDamage`. 58 testes, incluindo luta inteira determinística por seed e save/restore no meio da luta.
View: `EntityView` (quadrado + letra + barra de HP, flash no golpe, fade na morte, tremidinha em golpe ≥ 8), LOG de combate em português (`view/format.ts`), painel do Knight, overlay VICTORY / YOU DIED.
Decisões tomadas: **passar o turno** (Espaço / X); **Enter / A no fim começa run nova** com seed novo; **jogador sempre age primeiro**, depois os inimigos na ordem da lista.
Observação: o Goblin dummy (ATK 3) contra DEF 5 sempre dá 1 de dano — é o risco da §2.12 aparecendo cedo. Os monstros reais do Marco 4 precisam de ATK acima da DEF esperada do Knight em cada andar.

### Marco 2 — Loop de run
BSP real, corredores, STAIRS, transição de andar, câmera seguindo, `RunState` serializável + **suspender automático**, Item/Inventory/LootTable, Knight completo (4 skills, mana, passiva +2 HP por kill), XP/level, Training Room.

### Marco 3 — UI completa
HUD (HP/Mana, stats, equipamento de 8 slots + 3 relíquias), BattleLog lendo os eventos do core, hotbar 1–8 (**+ mapeamento no controle**), InventoryUI (Equipado/Pra vender), MiniMap + fog of war (`Set` de `pointKey` por andar).

### Marco 4 — Conteúdo MVP
Rat/Skeleton/Goblin/Orc com loot tables, Merchant Room + loja (venda 30%, compra 100%, +10% em item da vocação), Orc Warlord + Boss Room, 2 relíquias. Checar o risco de DEF da §2.12.

### Marco 5 — Meta-progressão
GameOverScene, HubScene (Sanctum: The Vault, Ancient Armory, Tome of Knowledge; Shrine of Vocations só pós-MVP), MetaProgress em LocalStorage versionado, Bestiary básico.

### Marco 6 — Polish
Balanceamento com simulação headless, tween de movimento (100 ms), screenshake leve, sprites Kenney, fonte pixel, tela inicial, áudio.

**Pós-MVP (v1.1+):** Sorcerer/Paladin/Druid, Floors 6–15, Dragon/Demon/Lich/Vampire, bosses 10/15, Bestiary progressivo, conquistas, toque na tela, modo fliperama (atração, ranking de 3 iniciais).

---

## 6. Convenções de código

- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- Discriminated unions pra resultados (`MoveResult = { tookTurn: false; reason } | { tookTurn: true; action: 'move' } | ...`).
- Entidades no core são dados + funções; o sprite mora na view.
- IA como estratégia injetada (`createEnemy(stats, ai)`), pra variantes no Marco 4.
- Constantes de balanceamento só em `core/balance.ts`.
- Lembrar o gosto do Felipe: **grind com retorno real** — todo kill rende algo (gold mínimo, item ou valor de venda).

---

## 7. Pendências e decisões em aberto

- [ ] Adicionar `docs/GAME_BRIEFING.md` (antes do Marco 2).
- [x] Passar o turno: Espaço / X (Marco 1).
- [ ] **"Sala explorada"** na Training Room: entrou na sala? Limpou os monstros? Decidir no Marco 2.
- [ ] Mapeamento das skills no controle (Marco 3).
- [ ] Empilhamento de DEF (§2.12) — vigiar no Marco 4.

---

## 8. Fluxo de trabalho

- Código num repositório GitHub, trabalhado pelo **Claude Code** (claude.ai/code ou app). Um commit/PR por Marco, com `npm run check` verde.
- Repositório público: `github.com/felipekaranb-hub/cryptveil`. Cada push na `main` roda testes + build e publica em **https://felipekaranb-hub.github.io/cryptveil/** (`.github/workflows/deploy.yml`). O Felipe valida cada Marco por esse link, sem instalar nada.
- Commits com o e-mail noreply do GitHub (o repositório é público).
- Primeira mensagem de uma instância nova: ler `CLAUDE.md` e este documento, dizer em que Marco o projeto está e apresentar o plano do próximo Marco para aprovação.
