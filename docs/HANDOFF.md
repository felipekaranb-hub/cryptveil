# 🗡️ CRYPTVEIL — Handoff v2

Atualizado em 01/10/2026 (Marco 2b). **Substitui o handoff v1.** Este documento é a **fonte única** do design do jogo.

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

O GDD original (`GAME_BRIEFING.md`, v1.0) **se perdeu** — nem o Felipe tem mais o arquivo. Não procurar nem pedir. O que não está neste documento ainda não foi decidido: cada lacuna é decidida no marco que precisa dela (2–3 opções + recomendação) e registrada aqui. Lacunas conhecidas na §7.

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
- Mapa numa câmera própria com viewport de **15×11 tiles (480×352)**, centralizado. Desde o Marco 2a ela segue o player, presa às bordas do mapa. O scroll é calculado à mão (`GameScene.centerCamera`), em pixels lógicos: `startFollow`/`setBounds` do Phaser erram o centro com `setOrigin(0,0)` + zoom = renderScale.
- HUD na **`UIScene`**, em paralelo, com câmera fixa. GameScene e UIScene conversam por eventos tipados (`src/view/events.ts`), nunca por referência direta.
- Celular em pé fica minúsculo (o jogo é paisagem). Aceito no MVP.

### 4.5 Dados

Monstros, itens, relíquias e skills em **`.ts` com `satisfies`**, não `.json`: id digitado errado numa loot table vira erro de compilação.

### 4.6 Save

- **Meta-progressão** (gold, upgrades, bestiário): LocalStorage, Marco 5, com `version` + migração.
- **Run em andamento — MUDOU no v2:** "suspender automático". Salvar a run ao trocar de andar e quando a aba for escondida (`visibilitychange`); ao abrir, oferecer "Continuar". Morte apaga o save (continua roguelite). Entregue no Marco 2a: formato e migração em `core/save/runSave.ts` (lógica pura), LocalStorage em `src/storage/runStorage.ts`. `?seed=` na URL ignora a run suspensa (é pra reproduzir bug). Motivo: navegador de celular mata aba em segundo plano e fechar a aba não pode custar a run.

### 4.7 Pastas

```
cryptveil/
├── CLAUDE.md                  # Instruções curtas pro Claude Code
├── docs/HANDOFF.md            # Este documento
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
    │   ├── events.ts          # CoreEvent (combate, descended, skill-used, healed, rewarded, looted, room-cleared, trained…)
    │   ├── hero.ts            # HeroState: mana, XP/level, gold, equipamento, inventário, Training Room
    │   ├── pathfinding.ts     # BFS 4-direções (bfsFirstStep)
    │   ├── run.ts             # RunState serializável, createRun, enterNextFloor, createTestRun, consultas
    │   ├── ai/strategies.ts   # AiStrategy, chase, registro AI_STRATEGIES (injetado por id)
    │   ├── data/entities.ts   # Modelos (knight, goblinDummy) com satisfies
    │   ├── dungeon/           # DungeonMap, TileType, Room, DungeonGenerator (BSP), populate (monstros)
    │   ├── save/runSave.ts    # RunState ↔ texto, versão e migração (suspender automático)
    │   ├── entities/Entity.ts # Entidade como dado puro
    │   ├── turn/              # TurnManager (resolvePlayerAction), combat, skills (+poções), rewards, rooms (sala explorada/Training)
    │   ├── items/             # Item (canEquip), Inventory (auto-equip), LootTable
    │   ├── (M5) meta/         # MetaProgress, Sanctum, Bestiary
    │   └── data/              # entities, items, lootTables, skills (+hotbar) — (M4) relics
    ├── input/InputController.ts
    ├── storage/runStorage.ts  # LocalStorage da run suspensa (try/catch: storage bloqueado não derruba o jogo)
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

### Marco 2 — Loop de run (dividido em 2a e 2b em 01/10/2026)

#### ✅ Marco 2a — A run (entregue em 01/10/2026)
BSP real (`DungeonGenerator`: folhas, uma sala por folha, corredor em L entre as salas mais próximas de cada divisão → andar sempre conexo), tile `STAIRS`, 5 andares, câmera seguindo o player, `RunState` v2 (`floor`, `rooms`) + suspender automático com "Continuar". 144 testes (60 seeds checando conexidade, escada alcançável, borda fechada e salas sem sobreposição; descida; vitória no andar 5; save ida e volta, v1 descartado, save corrompido rejeitado).
Decisões tomadas:
- Mapa **44×32**, folha mínima 10 → **6–12 salas por andar** (moda 8, medido em 500 seeds). Números em `balance.ts` (`DUNGEON`).
- Escada **só desce**, e pisar nela já desce: os monstros do andar velho não agem nesse turno. A escada fica no tile de sala mais longe do início, andando.
- Escada do **andar 5 = vitória** (placeholder; no Marco 4 o Warlord fica antes dela). Matar todos os monstros não vence mais nada.
- Monstros: 0–2 por sala, nunca na sala inicial. **Provisório:** Goblin dummy com +5 HP e +2 ATK por andar (`PLACEHOLDER_ENEMY_GROWTH`) até os monstros reais do Marco 4.
- **Aggro:** monstro só persegue o player a até 7 tiles (Manhattan, `AGGRO_RANGE`). Sem isso o andar inteiro convergia no primeiro turno. Não tem memória: se o player se afasta, ele para.
- Save: gravado ao descer e no `visibilitychange`; "Nova run" (Esc/B) na tela de "Continuar" apaga a suspensa; vitória e morte apagam.
- Sem regen de HP no 2a (a cura e a passiva entram no 2b): descer os 5 andares agora é difícil de propósito.

#### ✅ Marco 2b — O Knight (entregue em 01/10/2026)
Item/Inventory/LootTable, 4 skills com mana, passiva +2 HP por kill, XP/level, gold por kill, poções, salas exploradas e Training Room. `RunState` v3 (`hero`, `visitedRooms`, `clearedRooms`, `prompt`) com migração do save v2. Painel do Knight com HP/Mana/Nível/XP/Gold/poções/equipamento. 189 testes.
Decisões tomadas (além das da §7):
- **Loot vai direto pro inventário** (sem item no chão no MVP) e **auto-equip** se o item serve na vocação e soma mais ATK+DEF que o do slot; o antigo vai pro inventário. Provisório até a InventoryUI do Marco 3.
- **Alvo das skills:** o Knight guarda a direção do último passo/ataque (`facing`). Brutal Strike e Whirlwind Throw preferem o inimigo nessa direção, senão o primeiro na ordem N, S, E, W. Sem alvo, sem mana ou HP cheio → não gasta mana nem turno, e o LOG avisa.
- **Hotbar fixa:** 1 Brutal Strike · 2 Berserk · 3 Whirlwind Throw · 4 Wound Cleansing · 5 Poção HP · 6 Poção Mana. Usar poção gasta o turno. No controle as skills ainda não têm botão (Marco 3).
- **Training Room:** uma sala do andar (nem a inicial, nem a da escada), sem monstros, com um altar no centro. Pisar abre a escolha (←/→ + Enter/A); o turno trava até escolher, a escolha não gasta turno e o altar vira chão. Ganhar mais de uma de uma vez → uma por andar.
- Knight base ATK 7 + Sword (+3) = ATK 10 (o mesmo do Marco 1). DEF dos itens baixa de propósito (§2.12).
- Goblin provisório agora +3 ATK por andar (era +2), + XP, gold e loot por andar (`placeholderFloor1..3`, usando as chances da §2.4 dos monstros que vão morar ali).
- **Simulação headless** (bot simples: luta com o que encontra, cura abaixo de 50%, poção abaixo de 30%, 60 seeds): vence 27%, 32% morrem no andar 1, nível médio 2,6, DEF média 7,7. Base pro balanceamento do Marco 6.

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

- **Lacunas de design (GDD perdido) — decidir no marco indicado:**
  - [x] Marco 2 (decidido em 01/10/2026, números provisórios; balancear depois):
    - **Skills do Knight**, sem cooldown, só mana: **Brutal Strike** (1 alvo adjacente, ATK×1,5, 5 mana) · **Berserk** (4 adjacentes, ATK×1,0, 10 mana) · **Whirlwind Throw** (1 alvo em linha reta até 3 tiles, ATK×1,0, 8 mana) · **Wound Cleansing** (cura 25% do HP max, 10 mana).
    - **Mana:** 30 max no início, regenera 1 a cada 2 turnos. HP não regenera sozinho (só passiva +2 por kill e cura).
    - **XP:** o próximo nível custa `20 × nível atual` (20, 40, 60…). XP de cada monstro no template.
    - **Gold por kill:** faixa `goldMin`–`goldMax` no template, sorteada pelo `Rng`; todo kill rende ≥ 1.
    - Itens do Marco 2 = só os do Knight da §2.4 com chances provisórias. Inventário sem limite de slots no MVP. Gold fica no `RunState`; conversão em meta só no Marco 5.
  - [x] **Sala explorada** (Marco 2b): o player entrou nela **e** todos os monstros que nasceram nela morreram (sala vazia conta ao entrar). A cada 5, o próximo andar ganha uma Training Room.
  - [x] **Poções** (Marco 2b), drop de qualquer monstro, sorteio separado do loot: **HP** 5% de chance, cura 50% do HP max (decisão do Felipe). **Mana** 8% de chance, restaura 50% da mana max: mais comum e mais fraca porque a mana já regenera (1 a cada 2 turnos ≈ 70 por andar) e 15 de mana ≈ 1,5 Wound Cleansing ≈ 19 HP, menos que a poção de HP. Preço na loja: Marco 4.
  - [ ] Marco 4: loot tables completas (só as chances do Knight na §2.4 existem), stats de Rat/Skeleton/Goblin/Orc, preços dos itens, as 2 relíquias do MVP.
  - [ ] Marco 5: custos e efeitos de The Vault, Ancient Armory e Tome of Knowledge; taxa de conversão de gold no fim da run.
- [x] Passar o turno: Espaço / X (Marco 1).
- [ ] Mapeamento das skills no controle (Marco 3).
- [ ] Empilhamento de DEF (§2.12) — vigiar no Marco 4.

---

## 8. Fluxo de trabalho

- Código num repositório GitHub, trabalhado pelo **Claude Code** (claude.ai/code ou app). Um commit/PR por Marco, com `npm run check` verde.
- Repositório público: `github.com/felipekaranb-hub/cryptveil`. Cada push na `main` roda testes + build e publica em **https://felipekaranb-hub.github.io/cryptveil/** (`.github/workflows/deploy.yml`). O Felipe valida cada Marco por esse link, sem instalar nada.
- Commits com o e-mail noreply do GitHub (o repositório é público).
- Primeira mensagem de uma instância nova: ler `CLAUDE.md` e este documento, dizer em que Marco o projeto está e apresentar o plano do próximo Marco para aprovação.
