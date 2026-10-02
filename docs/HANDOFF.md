# 🗡️ CRYPTVEIL — Handoff v2

Atualizado em 02/10/2026 (Marco 6b). **Substitui o handoff v1.** Este documento é a **fonte única** do design do jogo.

---

## 0. Como trabalhar neste projeto

- **Idioma:** português (Brasil). Identificadores de código em inglês; comentários em português quando explicam decisão de design.
- **Postura:** dev sênior de jogos web, direto e prático, com trade-offs honestos em vez de otimismo.
- **Confirmação antes de operações grandes:** antes de cada Marco, apresentar o plano (arquivos, mini-decisões, trade-offs) e esperar o OK.
- **Validação visual por Marco:** o Felipe roda e confirma ("rodou OK" ou screenshot) antes de avançar.
- **Decisão não prevista aqui:** perguntar com 2–3 opções e uma recomendação. Não inventar.
- **Antes de entregar qualquer coisa:** `npm run check` (typecheck + testes) tem que passar.

---

## 0.1 Vocabulário (combinado com o Felipe em 01/10/2026)

Hierarquia, do menor pro maior. Usar **sempre** esses termos, em conversa, código e documento:

| Termo | O que é | No código |
|---|---|---|
| **Sala** | Retângulo dentro de um andar, ligado a outras salas por corredores. Um andar tem 6–12. | `Room` |
| **Andar** | Tudo que existe entre uma escada e a próxima. | `floor` |
| **Região** | Conjunto de andares. **Toda região tem um boss, no último andar dela.** No MVP: Região 1 = andares 1–5, boss Orc Warlord. | (Marco 4) |
| **Run** | Uma tentativa inteira, do andar 1 até morrer ou vencer. | `RunState` |

- **Sala de treino** (Training Room) é uma *sala* especial dentro de um *andar*.
- "Sala explorada" = sala em que o player entrou e matou os monstros que nasceram nela.

## 1. O jogo em uma frase

Roguelite por turnos no navegador, inspirado em Tibia: Knight desce 5 andares gerados por BSP, mata monstros, junta loot, enfrenta o Orc Warlord no andar 5; o que sobra de gold vira meta-progressão no Sanctum.

O GDD original (`GAME_BRIEFING.md`, v1.0) **se perdeu** — nem o Felipe tem mais o arquivo. Não procurar nem pedir. O que não está neste documento ainda não foi decidido: cada lacuna é decidida no marco que precisa dela (2–3 opções + recomendação) e registrada aqui. Lacunas conhecidas na §7.

---

## 2. Decisões de design (fechadas)

Herdadas do v1, sem mudança. **Não re-perguntar.**

| # | Tema | Decisão |
|---|---|---|
| 2.1 | Sorcerer | Staff alcance 3; ataque básico é mágico e ignora shield/defesa pesada. Pós-MVP. |
| 2.2 | Boss do Floor 5 | **Orc Warlord** (HP ~500 — **750 desde o ajuste pós-6b**, invocando a cada **2** turnos; dano 18–30 → ATK 24, convoca 1 Orc a cada 3 turnos, enraged <30% HP = +50% dano). Drops: Crown Helmet OU Magic Sword; sempre Tower Shield; ~50g. Dragon Lord fica pro v1.1. Implementado no Marco 4 (detalhes na §5). |
| 2.3 | Monstros do MVP | **Rat, Skeleton, Goblin, Orc.** Dragon volta no v1.1. |
| 2.4 | Equipamento do Knight | Começa com Sword. Tabela abaixo. |
| 2.5 | Itens | `equipTags: Vocation[]`. Drop universal, equip restrito (`canEquip` aceita a vocação ou `'ALL'`). Fora da vocação → aba "Pra vender". |
| 2.6 | Stats | Só **ATK** e **DEF**. Skills usam o mesmo ATK. Crítico, vampirismo etc. são *efeitos de carta*, não stats (Marco 2d). |
| 2.7 | Training Room e level up | **Sala de treino:** a cada **16** salas exploradas (≈ 0,5 por andar pra quem explora; regra **implícita**, o jogador não vê contador — Marco 2d), o próximo andar gera 1: escolha única +2 ATK ou +2 DEF. Não persiste entre runs. **Level up** (mudou no Marco 2d): +10 HP max, +10 Mana max **e escolha de 1 entre 3 cartas** (§5, Marco 2d). |
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

### 2.12 Fórmula de dano — **MUDOU no Marco 6a** (DEF em porcentagem)

```
rolagem = sorteio inteiro em [round(ATK × 0,75), round(ATK × 1,25)]
dano    = max(1, round(rolagem × K / (K + DEF)))      K = 20 (DEF_MITIGATION_K)
```

DEF 5 corta 20% do dano, DEF 15 ~43%, DEF 20 metade; nunca zera. Implementada em `src/core/combat/damage.ts` (`mitigate`), constantes em `src/core/balance.ts`, testada.
Histórico: o v1 era `max(1, ATK − DEF)` (não dava a faixa "18–30" do boss); o v2 trouxe a rolagem mas manteve `rolagem − DEF`, e a DEF empilhada do Knight (4 slots + Training Room + Guarda) deixou Skeleton e Orc batendo 1 no fim da região (confirmado no Marco 4). No Marco 6a o Felipe escolheu a redução percentual (opção A; as outras eram subir o ATK dos monstros ou subtrair metade da DEF).

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
| Assets | **Kenney Tiny Dungeon + Tiny Town (CC0, 16 px, desenhados a 2× no tile de 32)** e sprites próprios no mesmo estilo, num atlas único (Marco 6b; ver §5). Fonte **VT323** (OFL, via `@fontsource/vt323`, empacotada: roda offline). Efeitos sonoros sintetizados na Web Audio API, sem arquivos. |
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
| Hotbar 1–4 (skills) | 1–4 | **segurar LB** + A / B / X / Y (Marco 3) |
| Hotbar 5–8 (poções; 7–8 reservados) | 5–8 | **segurar RB** + A / B / X / Y (Marco 3) |
| Inventário | I | Y |
| Trocar aba (inventário) | Q / E (ou ←/→) | LB / RB sozinhos (ou ←/→) |
| Confirmar (no fim da run: vai pro resumo) | Enter | A |
| Rerrolar a escolha de carta (Tome "Releitura", Marco 5) | Espaço | X |
| Cancelar | Esc | B |
| Som liga/desliga (Marco 6b) | M | Select / Back |

Repetição de movimento: 130 ms (constantes no `InputController`). Com um ombro segurado, os botões de face viram hotbar e não fazem a ação normal. A hotbar e a linha de ajuda mostram a tecla ou o combo conforme o **último input usado**. **Toque na tela fica pós-MVP.**

### 4.4 Tela

- Resolução **lógica** 960×540 (16:9): todo o código usa essas coordenadas. O canvas é desenhado na resolução **física** da tela (considera `devicePixelRatio`, ou seja, escala do Windows em 125%/150% e telas retina), então texto e bordas saem nítidos. Ver `src/view/scaling.ts`.
- `renderScale` = pixels físicos por pixel lógico: inteiro quando ≥ 2 (pixel art uniforme), fracionário abaixo disso pra preencher a tela. As câmeras usam `layoutCamera()` e os textos ganham `setResolution(scale)` via `bindRenderScale()`. **Texto criado depois do `create()` precisa de `setResolution(getRenderScale())`.**
- Mapa numa câmera própria com viewport de **15×11 tiles (480×352)**, centralizado. Desde o Marco 2a ela segue o player, presa às bordas do mapa. O scroll é calculado à mão (`GameScene.centerCamera`), em pixels lógicos: `startFollow`/`setBounds` do Phaser erram o centro com `setOrigin(0,0)` + zoom = renderScale.
- HUD na **`UIScene`**, em paralelo, com câmera fixa. GameScene e UIScene conversam por eventos tipados (`src/view/events.ts`), nunca por referência direta.
- Celular em pé fica minúsculo (o jogo é paisagem). Aceito no MVP.

### 4.5 Dados

Monstros, itens, relíquias e skills em **`.ts` com `satisfies`**, não `.json`: id digitado errado numa loot table vira erro de compilação.

### 4.6 Save

- **Meta-progressão** (gold, upgrades, bestiário): LocalStorage (`cryptveil.meta`), entregue no Marco 5 com `version` + migração. Formato em `core/meta/metaProgress.ts`, storage em `src/storage/metaStorage.ts`. Save ilegível não é apagado: o jogo começa uma meta nova e só sobrescreve quando houver algo pra salvar.
- **Run em andamento — MUDOU no v2:** "suspender automático". Salvar a run ao trocar de andar e quando a aba for escondida (`visibilitychange`); ao abrir, oferecer "Continuar". Morte apaga o save (continua roguelite). Desde o Marco 5 o "Continuar" fica no Sanctum (era um overlay em cima do mapa). Entregue no Marco 2a: formato e migração em `core/save/runSave.ts` (lógica pura), LocalStorage em `src/storage/runStorage.ts`. `?seed=` na URL ignora a run suspensa (é pra reproduzir bug). Motivo: navegador de celular mata aba em segundo plano e fechar a aba não pode custar a run.

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
    │   ├── hero.ts            # HeroState: mana, XP/level, gold, equipamento, inventário, skills, cartas
    │   ├── cards.ts           # Sorteio de cartas (peso por raridade), aplicar carta, abrir escolha
    │   ├── fog.ts             # Fog of war: tiles visíveis agora e explorados no andar (Marco 3)
    │   ├── shop.ts            # Mercador: estoque, preços (compra/venda, bônus da vocação), comprar/vender (Marco 4)
    │   ├── pathfinding.ts     # BFS 4-direções (bfsFirstStep)
    │   ├── run.ts             # RunState serializável, createRun, enterNextFloor, createTestRun, consultas
    │   ├── ai/strategies.ts   # AiStrategy: chase e skirmisher (arremessa de longe), registro AI_STRATEGIES (injetado por id)
    │   ├── data/entities.ts   # Knight, Rat, Goblin, Skeleton, Orc, Orc Warlord (+ goblinDummy dos testes) com satisfies
    │   ├── dungeon/           # DungeonMap, TileType, Room, DungeonGenerator (BSP), populate (monstros)
    │   ├── save/runSave.ts    # RunState ↔ texto, versão e migração (suspender automático)
    │   ├── entities/Entity.ts # Entidade como dado puro
    │   ├── sim/               # Simulação headless de balanceamento (bot fixo + resumo)
    │   ├── turn/              # TurnManager (resolvePlayerAction), combat, skills (+poções), rewards, rooms (sala explorada/Training)
    │   ├── items/             # Item (canEquip), Inventory (auto-equip, equipar/desequipar), LootTable
    │   ├── meta/metaProgress.ts # MetaProgress (save versionado), compra de upgrade, conversão do gold, bônus da run, resumo (Marco 5)
    │   └── data/              # entities, items (+ materiais), lootTables, skills (níveis + hotbar), cards, relics, shop, sanctum (prédios, upgrades, bestiário)
    ├── config/sprites.ts       # Frame do atlas de cada entidade, tile e item; tints (Marco 6b)
    ├── input/InputController.ts
    ├── storage/               # runStorage (run suspensa), metaStorage (meta) e settingsStorage (mudo) no LocalStorage, com try/catch
    ├── scenes/                # BootScene, HubScene (Sanctum), GameScene (mundo), UIScene (HUD), GameOverScene
    └── view/                  # coords (tile↔pixel), scaling, events, format (LOG), EntityView (sprite + tween), audio/sfx (Web Audio)
        └── hud/               # model (RunState → dados do HUD), StatusPanel, Hotbar, BattleLog, MiniMap, InventoryScreen, ChoiceScreen
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
- Knight base ATK 7 + Sword (+3) = ATK 10 (o mesmo do Marco 1; desde o Marco 6a, base 8 → ATK 11). DEF dos itens baixa de propósito (§2.12).
- Goblin provisório agora +3 ATK por andar (era +2), + XP, gold e loot por andar (`placeholderFloor1..3`, usando as chances da §2.4 dos monstros que vão morar ali).
- **Simulação headless** (bot simples: luta com o que encontra, cura abaixo de 50%, poção abaixo de 30%, 60 seeds): vence 27%, 32% morrem no andar 1, nível médio 2,6, DEF média 7,7. Base pro balanceamento do Marco 6.

#### ✅ Marco 2c — Ajustes de sensação (entregue em 01/10/2026)
Feedback do Felipe jogando o 2b: cura + regen de mana era exploit; Training Room demais; equipamento e treino não se sentiam; skills batiam igual ao golpe básico; drop alto.
- **Mana só de lutar:** sem regen por turno; **+4 de mana por kill** (`MANA_PER_KILL`), além de poção e level up. Esperar não rende nada.
- **Training Room a cada 6 salas** (o Felipe pediu 5–6; §2.7 atualizada). Com ~8 salas por andar, quem limpa o andar inteiro ainda ganha quase uma por andar.
- **Skills:** Brutal Strike ×2,0 · Berserk ×1,25 em cada alvo · Whirlwind Throw ×1,5. Custos iguais.
- **Golpes por kill importam:** Goblin provisório com 24 HP base +8 por andar (era 15 +5); itens com bônus maiores (Spike Sword +8, Magic Sword +15; armaduras 2/4/7, elmos 1/3/5, escudos 2/4/7).
- **Feedback visual:** número de dano/cura/mana flutuando em cima da entidade (antecipado do Marco 6) e LOG com "ATK 10 → 15" ao equipar ou treinar. Tremidinha só quando o player leva ≥ 20% do HP max.
- **Drop:** fica como está (provisório; revisar no Marco 4/6).
- **Simulador headless** em `src/core/sim/` (`SIM=200 npx vitest run src/core/sim`). Mesma régua (bot fixo), 100 seeds: vence **44%**, 3,6 golpes por kill (era 1,8), mortes concentradas nos andares 4–5, nível médio 4, ATK/DEF finais médios 13,8 / 12,6, ~22 skills por run.
- O "ATK 20 batendo 10" relatado não é bug: com ATK 20 o golpe básico no Goblin dá no mínimo 14. Provavelmente era o Goblin batendo no Knight (o LOG confundia; os números flutuantes resolvem).

#### ✅ Marco 2d — Level up com cartas (entregue em 01/10/2026)
Pedido do Felipe: sentir progressão de roguelike deckbuilder a cada nível. Modelo escolhido: **escolha de carta no level up + cartas que liberam skills** (estilo Hades), não deckbuilder de mão/baralho.
- **O Knight começa só com o Brutal Strike.** Berserk e Whirlwind Throw saem como cartas **raras**; Wound Cleansing como carta **épica** (a mais rara: única cura fora de poção).
- **Carta de skill repetida sobe o nível** da skill (máx. 3). Níveis: Brutal Strike ×2 → custa 3 → ×2,5 · Berserk ×1,25 → ×1,6 → custa 8 · Whirlwind ×1,5 linha 3 → atravessa (todos da linha) → alcance 5 · Wound Cleansing 25% → 40% → custa 6.
- **Cartas de stat/passiva** (empilham até o limite): Força +15% ATK (5×) · Vigor +20 HP max e cura 20 (5×) · Guarda +2 DEF (5×) · Foco +15 mana max (3×) · Vampirismo cura 15% do dano causado (rara, 1×) · Sede de Sangue +3 mana por kill (3×) · Golpe Crítico 15% de dano ×2 (rara, 2×) · Contra-ataque 25% de revidar (rara, 1×) · Pele de Ferro −2 de dano recebido, mín. 1 (rara, 2×) · Caçador +1 gold e +2 XP por kill (3×).
- **Sorteio:** 3 cartas diferentes por nível, peso comum 60 / rara 30 / épica 10. Skill no nível máximo e passiva no limite saem do sorteio. Vários níveis de uma vez → escolhas em sequência. A escolha não gasta turno.
- **Curva de XP** = 8 + 3 × (nível − 1) (era 20 × nível) → ~8 níveis por região.
- **Hotbar:** cada skill sempre no mesmo slot (1–4); travada aparece "—". A linha da hotbar mostra nível e custo.
- **Tela de escolha** unificada: cartas lado a lado (borda na cor da raridade, selecionada com moldura dourada); a Training Room usa a mesma tela com 2 cartas.
- Monstro provisório +10 HP e +4 ATK por andar (era +8/+3).
- `RunState` v4 (`hero.skills`, `hero.cards`, `hero.pendingCardPicks`, prompt como objeto) com migração do v3 (Knight antigo mantém as 4 skills).
- **Simulação** (100 seeds, bot com prioridade fixa de cartas): vence 64%, ~8,4 cartas por run, nível médio 9,4, mortes espalhadas pelos andares. Sem boss ainda: o Orc Warlord (Marco 4) é quem deve segurar o fim da região.

### ✅ Marco 3 — UI completa (entregue em 01/10/2026)
HUD inteiro, inventário, minimapa e fog of war. `RunState` v5 (`explored`) com migração do v4. 227 testes.
- **Layout:** painel esquerdo = Knight (HP/Mana/XP, ATK/DEF, gold, andar, turno, tamanho do deck, **paper doll de 8 slots** estilo Tibia com siglas até os sprites, **3 relíquias** vazias até o Marco 4). Painel direito = **minimapa** em cima e **LOG colorido** embaixo (dano levado em vermelho, cura verde, mana azul, loot dourado, nível lilás). Embaixo = **hotbar de 8 caixas** (tecla/combo, nome, nível, custo; apagada se travada, custo vermelho sem mana ou sem poção) e a linha de ajuda.
- A UIScene não lê o `RunState`: a GameScene monta modelos (`view/hud/model.ts`) e manda por evento (`hud`, `minimap`, `inventory-view`, `input-source`).
- **Skills no controle** (decisão do Felipe, opção A): combo de ombro. Segurar LB + A/B/X/Y = slots 1–4, RB + A/B/X/Y = 5–8 (§4.3). Funciona num bartop de 6–8 botões sem menu.
- **Fog of war** (opção A): dentro de uma sala vê a sala inteira e o anel de parede (portas); no corredor vê até **2 tiles andando pelo chão** (`CORRIDOR_VISION`, não atravessa parede). Explorado fora de vista fica escurecido; nunca visto fica preto. **Monstro só aparece onde o Knight vê agora.** O explorado é só do andar atual (array de índices `y*width+x` no save) e zera ao descer. A fog é só apresentação: IA e combate não olham pra ela, então a simulação não muda.
- **Inventário** (I / Y), por cima do mapa (painéis laterais continuam à vista), 3 abas: **Mochila** (equipado + itens usáveis, com ↑/↓ comparando com o slot), **Pra vender** (`canEquip` falso, §2.5; venda no Marco 4) e **Deck** (skills com nível e custo, cartas com pilhas). Abrir e navegar é grátis; **equipar, tirar ou usar poção gasta 1 turno** (opção A). Ações novas no core: `equip`, `unequip`, `use-item`.
- **Auto-equip continua** (opção A): item melhor que o do slot veste sozinho; o inventário serve pra desfazer/trocar.
- **Deck na tela** (opção A): aba Deck no inventário + contador "Deck N" no painel (N = cartas escolhidas na run: níveis de skill ganhos em carta + pilhas das passivas).
- Testado no Chromium: HUD, fog, inventário (equipar/trocar de aba), controle simulado (LB+A soltou o Brutal Strike, RB trocou a aba) e um bot pelas teclas descendo até o andar 5 sem erro no console.

### ✅ Marco 4 — Conteúdo MVP (entregue em 01/10/2026)
Monstros reais, loot completo, mercador e loja, Orc Warlord e relíquias. `RunState` v6 (`merchant`, `hiddenStairs`, `hero.relics`, habilidades e recargas nos monstros) com migração do v5. 253 testes.
Decisões do Felipe (plano com 10 perguntas):
- **Dificuldade por andar:** monstros com **stats fixos** (um Rat é sempre um Rat). O andar fica mais difícil pela **mistura** e pela **lotação** (`FLOOR_SPAWNS` em `balance.ts`):

  | Andar | Monstros por sala | Mistura (peso) |
  |---|---|---|
  | 1 | 0–2 | Rat 60 · Goblin 40 |
  | 2 | 0–2 | Rat 25 · Goblin 50 · Skeleton 25 |
  | 3 | 0–3 | Goblin 35 · Skeleton 45 · Orc 20 |
  | 4 | 1–3 | Skeleton 50 · Orc 50 |
  | 5 | 1–3 | Skeleton 30 · Orc 70 (+ boss) |

- **Stats (provisórios):** Rat HP 20 / ATK 7 / DEF 0 · Goblin 30/8/1 · Skeleton 44/11/2 · Orc 56/16/3 · Orc Warlord 500/24/4. XP 4/6/9/13/60; gold 1–3, 2–4, 3–6, 4–8, 45–55.
- **Ataque de longe (misto, decisão do Felipe):** só quem faz sentido arremessa — **Goblin (pedra, alcance 3, ×0,6), Orc (lança, alcance 4, ×0,7), Orc Warlord (facas, alcance 4, ×0,6)**. Em linha reta, sem parede nem ninguém no meio, com **recarga** (3–4 turnos); nos outros turnos o monstro **continua avançando** (ganha turno sem virar kiting, pra classe ranged não ficar forte demais depois). Estratégia `skirmisher`. Rat e Skeleton só perseguem. Na simulação o arremesso não muda a taxa de vitória (é sabor, não muro). Quem arremessa aparece na tela no turno do arremesso mesmo fora da visão, e o projétil é animado.
- **Produtos de criatura** (só pra vender, tipo `material`): Cheese (Rat 50%), Goblin Ear (35%), Bone (Skeleton 40%), Orc Tooth (35%). Vão pra aba "Pra vender". Equipamento com as chances da §2.4.
- **Mercador:** uma Merchant Room garantida nos **andares 2 a 5** (sala sem monstros, tile de balcão). Pisar abre a loja; comprar e vender **não gastam turno**; Esc/B sai (I/Y não fecha a loja, pra não sair sem querer). Estoque: **poções sempre** (HP 25g, Mana 18g), **3 equipamentos** sorteados do nível do andar (comprou, acabou) e **1 relíquia** que o player ainda não tem.
- **Preços:** compra 100% do valor, venda 30%. **Item da vocação** (feito pro Knight, não `ALL`) **vende +10% e compra +10%** (decisão do Felipe: as duas coisas). Todo item vende por ≥ 1g.
- **Orc Warlord:** fica no lugar da escada do andar 5, sozinho na sala; **a escada só aparece quando ele morre, no tile onde ele caiu** (decidido na implementação: nascer no lugar original deixava a escada às vezes debaixo do Knight, que tinha de sair e voltar). Descer = vitória. Invoca **1 Orc a cada 3 turnos** com o player a até 7 tiles, **máximo 3 vivos**; os invocados rendem **só metade do XP** (sem gold, loot, poção, mana ou cura de kill — não dá pra farmar). Abaixo de 30% **enfurece** (×1,5, corpo vermelho). Drop: Crown Helmet OU Magic Sword, sempre Tower Shield, Plate 40%, Demon Shield 25%. Barra de HP no topo da tela durante a luta.
- **Relíquias (as 4, decisão do Felipe), compradas no mercador, 3 slots:** Ídolo Dourado (+50% gold por kill, 55g) · Olho do Vigia (visão 4 no corredor e a escada aparece no minimapa ao chegar, 45g) · Pedra de Sangue (kill cura 5% do HP max, 75g) · Totem de Guerra (1º golpe em cada monstro ×2, 85g).
- **Simulação** (bot agora vende material/equipamento pior, compra relíquia e até 3 poções de HP; 200 seeds): antes do Marco 4 vencia **64%** (sem boss). Agora **vence 41%**; **66% chegam ao boss e 62% deles o derrotam**; mortes por andar 19/9/24/16/50; nível médio 10,4 (8,6 ao chegar no 5); ~119 de gold de kills por run; só 0,3 relíquia por run (o bot gasta pouco; jogador de verdade deve comprar mais — revisar no Marco 6).
- **Ajuste pós-teste do Felipe (venda):** vender pilha era um Enter por unidade. Agora, em item com mais de 1 unidade, o Enter pergunta **"Todos ×N (+Xg)" (padrão) ou "Só 1"**; a ação `sell` ganhou `count` e o evento `sold` traz a quantidade e o total.
- **Risco da §2.12 apareceu:** DEF média final do Knight 15,2. Skeleton (ATK 11, rolagem 8–14) já dá quase sempre 1 de dano nos andares 4–5, e o Orc (12–20) dá 1–5. Quem ameaça no fim é o volume (salas cheias, arremessos) e o boss (ATK 24, ×1,5 enfurecido). Fica pro Marco 6 decidir: subir ATK dos monstros do fim, ou dano com redução percentual.

### ✅ Marco 5 — Meta-progressão (entregue em 01/10/2026)
Sanctum (`HubScene`), resumo do fim da run (`GameOverScene`), `MetaProgress` versionado no LocalStorage, bestiário básico. `RunState` v7 (`runStats` com kills por monstro; `hero.xpBonusPct`, `bonusOfferCards`, `rerolls`) com migração do v6. 275 testes.
Decisões do Felipe (plano com 5 perguntas; números provisórios, em `balance.ts` → `META`):
- **Fluxo:** abrir o jogo → **Sanctum** (tela inicial): Continuar run (se houver suspensa) · Descer à cripta / Nova run · The Vault · Ancient Armory · Tome of Knowledge · Bestiário. Fim da run → VICTORY/YOU DIED no mapa → Enter/A → resumo (andar, nível, turnos, kills, gold convertido) → Sanctum. `?seed=` na URL pula o Sanctum (reproduzir bug), mas a run nasce com os upgrades comprados.
- **Conversão do gold (1A):** o gold que **sobrou** no fim da run vai pro Sanctum: **vitória 100%, morte 50%**. Gastar no mercador compete com guardar, de propósito. A meta é salva **na hora** da morte/vitória (fechar a aba no resumo não perde nada).
- **Run abandonada** (decidido na implementação): "Nova run" com uma suspensa pede confirmação (padrão "Não") e **conta como morte** (converte o gold e soma as kills).
- **The Vault (2A):** sobe a conversão na morte. O plano dizia "50% → 65% → 80%" com 3 preços; ficou **50 → 60 → 70 → 80%** (3 níveis: 60 / 150 / 300g), mantendo o teto de 80%.
- **Ancient Armory (3A):** **Afiar** +1 ATK por nível (80 / 160 / 320g) e **Reforçar** +10 HP max por nível (60 / 120 / 240g). Sem DEF (§2.12).
- **Tome of Knowledge (4A+B), duas trilhas:** **Saber**, níveis em sequência (100 / 200 / 350g): 1ª escolha de carta da run com 4 opções → começa a run com 1 carta escolhida (a escolha abre no turno 0; com o nível 1, vem com 4) → +15% de XP por kill. **Releitura**: rerrolar a escolha de carta 1 / 2 / 3 vezes por run (50 / 100 / 200g). Rerrolar é **Espaço / X** na tela de cartas (o mesmo botão de passar o turno; a dica aparece só com rerrolagem sobrando), não gasta turno e não repete as cartas que estavam. Training Room não rerrola.
- **Bestiário (5A):** os 5 monstros da Região 1 com total de kills; stats (HP/ATK/DEF/XP/gold) só depois da 1ª kill. Conta todo kill do player, inclusive os Orcs invocados pelo boss.
- **Os upgrades valem a partir da run nova** e ficam gravados no herói (o save da run não depende da meta depois de criada). Mesmo seed → mesmo andar 1 com ou sem meta; a carta inicial sorteia depois do mapa.
- Sanctum inteiro custa **2.490g**. Com ~120g de kills por run (o que sobra depende do quanto se gasta no mercador) e 50% na morte, são umas 25–40 runs pra completar: provavelmente longo demais; revisar no Marco 6 junto com a renda de gold.
- **Simulação** (mesma régua, 200 seeds): sem meta continua **41%** (o Sanctum não mexe na run base). Com o Sanctum no máximo: **vence 59%**, 69% chegam ao boss e 85% deles o derrotam, nível médio 11,7, ATK final 25,2. Rodar: `SIM=200 npx vitest run src/core/sim --silent=false` (imprime as duas).
- Detalhes técnicos: o `InputController` ignora o primeiro frame do controle (botão que confirmou a troca de cena não dispara de novo na cena nova). Cartas da tela de escolha encolhem pra caber 4.

### Marco 6 — Polish (dividido em 6a e 6b em 02/10/2026)

#### ✅ Marco 6a — Balanceamento (entregue em 02/10/2026)
Só números e fórmula; nada visual, o save não muda de versão. 277 testes.
Decisões do Felipe:
- **DEF em porcentagem** (§2.12, opção A): `dano = rolagem × 20 / (20 + DEF)`.
- **Meta de dificuldade (opção C):** bot sem meta vencendo ~15%. Pro Sanctum no máximo a meta era ~35%, mas medido não dá pra separar as duas coisas mexendo só em monstro (o Sanctum vale ~30 pontos). O Felipe escolheu **manter os efeitos do Sanctum** e aceitar o máximo onde cair (opção B), porque as salas e andares futuros vão mexer nesse winrate quando o jogo estiver completo.
- **Sanctum (3C) e relíquias (4B): preços ficam como estão.**
Ajustes (todos medidos na simulação, 200 seeds; ruído de ±3 pontos entre rodadas):
- **Knight ATK base 7 → 8** (ATK 11 com a Sword). Com a DEF em porcentagem, ATK é o que mais pesa: +1 ATK subiu o bot de ~9% pra ~15%. Mais HP quase não muda (Knight com 60 de HP: igual).
- **Orc ATK 16 → 14** e **Skeleton ATK 11 → 10**: com a fórmula nova eles batem de verdade; os valores antigos faziam do andar 3 um muro.
- **Andar 3: 0–2 monstros por sala** (era 0–3), mesma razão.
- **Orc Warlord DEF 4 → 2** (o §2.2 não fixa a DEF): sem isso, de quem chega ao boss o bot vence só ~24% (com DEF 2, ~30–38%).
- Testados e descartados (efeito dentro do ruído): cura por kill 3 (fica 2), mistura do andar 4 com menos Orc.
- Peso de cada upgrade do Sanctum (no máximo, sozinho, com os números de antes do ATK 8; base ~9%): Afiar 27% · Tome (Saber + Releitura) 30% · Reforçar 13%.

| Simulação (200 seeds) | Marco 5 | Só a fórmula nova | **Marco 6a** |
|---|---|---|---|
| Sem meta: vence | 41% | 7% | **14%** |
| Sem meta: chega ao boss / mata (de quem chega) | 66% / 62% | 27% / 24% | **46% / 30%** |
| Sem meta: mortes por andar (1–5) | 19/9/24/16/50 | 19/19/69/39/41 | **19/19/35/35/64** |
| Sanctum no máximo: vence | 59% | 47% | **42%** |
| Gold de kills por run (sem meta) | 119 | — | **78** |

- **Efeito colateral:** como o bot morre mais cedo, a renda de gold caiu (~78g por run sem meta). O Sanctum (2.490g) fica ainda mais longo de completar; o Felipe decidiu manter os preços por ora (3C).

#### ✅ Ajuste pós-6b — Dificuldade (02/10/2026, em teste pelo Felipe)
Feedback do Felipe jogando: "ainda fácil; cheguei no boss com mana pra spammar Berserk e matar todos". Causa: o level up enchia +10 de mana, cada kill rendia +4 (~120 de mana no andar 5) e o Berserk acerta o boss e os Orcs invocados juntos. Das opções (A mana mais apertada, B boss resiste a área, C recarga nas skills, D boss mais forte) o Felipe escolheu **A + C + D pra testar**:
- **A)** O level up **só aumenta a mana máxima** (não enche mais) e a **mana por kill caiu de 4 pra 3**.
- **C)** **Recarga nas skills** (`SKILL_COOLDOWNS` em `balance.ts`, em turnos do player: usou no turno t, volta no t + N): Brutal Strike 0 (golpe base), **Berserk 3**, Whirlwind Throw 2, Wound Cleansing 5. Muda a decisão do Marco 2 ("sem cooldown, só mana"). A hotbar mostra "espera N" em vermelho; tentar usar recarregando não gasta mana nem turno. `RunState` v8 (`hero.cooldowns`) com migração do v7.
- **D)** **Orc Warlord: HP 500 → 750** e **invocação a cada 2 turnos** (era 3; ainda no máximo 3 vivos).
- **Simulação (bot, 200 seeds; sem meta / Sanctum no máximo):** antes **14% / 42%**; depois **0% / 22%** (sem meta, 14% chegam ao boss e nenhum o mata). Cada mudança sozinha (150 seeds): só C 15% / 43% (o bot não spamma Berserk, então a recarga não pesa pra ele: ela mira o jeito que o Felipe joga); **só A 1% / 33%** (o bot depende de mana pra cura e Brutal Strike); só D 8% / 34%.
- **Atenção:** pela régua do bot, o jogo ficou duríssimo. Se o Felipe achar demais, o primeiro botão a girar é a mana (A): devolver os +4 por kill ou o enchimento parcial no level up.

#### ✅ Marco 6b — Polish (entregue em 02/10/2026)
Só view: o core, o save e a simulação não mudaram. 277 testes.
- **Sprites:** o Felipe queria os do **Tibia**. Não dá: são da CipSoft, e o repositório e o site são públicos (qualquer sprite que entra lá fica acessível, divulgando ou não). Fica em aberto o **pacote de sprites local** (pasta fora do repositório no PC do fliperama), se ele quiser usar sprites próprios só em casa (§7). Opções vistas e recusadas: Dungeon Crawl (CC0, 32 px), Stendhal (CC-BY-SA, 48×64, estilo MMO), Shattered Pixel Dungeon (GPL, 16 px). Escolhido o estilo **Kenney Tiny Dungeon** (CC0, 16 px a 2×), porque é simples o bastante pra **estender** com sprites próprios quando vierem classes, armas e monstros novos.
  - Atlas único `public/assets/sprites/atlas.png`, montado por `tools/sprites/build_atlas.py` (Pillow) a partir de `tools/sprites/src/` (os PNGs da Kenney e as licenças). Frames: Tiny Dungeon 0–131, Tiny Town 132–263, **próprios 264+**. Mapeamento em `src/config/sprites.ts` (entidade pelo nome; monstro sem sprite cai no fantasma).
  - **Desenhados no estilo do pack (frames 264–266):** Skeleton (do zero), **Orc** (o ciclope 109 do pack, com pele verde, dois olhos e presas) e **Orc Warlord** (Orc mais escuro, chifres, olhos vermelhos e armadura vermelha; desenhado 1,25× maior). O Goblin é o 112, o Rat o 124, o Knight o 97.
  - Os outros "Tiny" da Kenney foram olhados: Tiny Battle é militar moderno (nada serve), Tiny Farm é fazenda; o **Tiny Town** entra no atlas por arco/flecha, chave, bomba, paredes e portas extras (pras classes e andares futuros).
  - **Escurecer "mas não muito"** (decisão do Felipe): tint multiplicativo por camada (`SPRITE_TINTS`): chão mais escuro, paredes, objetos e entidades quase normais.
  - **Mapa:** chão com variações (estáveis por posição); parede com chão logo abaixo = face de tijolo; o resto da parede que encosta em chão = topo escuro com borda de pedra desenhada em código (sem autotile). Escada, altar da Training Room e mercador (baú) por cima do chão.
  - **Ajuste pós-teste do Felipe:** o Rat do pack (124, visto de cima) parecia um capacete e o Goblin tinha pele humana. Agora o **Rat é próprio, de perfil**, e o **Goblin é o 112 com pele verde e bandana vermelha** (pra não confundir com o Orc). Também ganharam ícone próprio **todos os itens e relíquias** que não tinham (3 armaduras, 3 elmos, Tower e Demon Shield, Magic Sword com lâmina azul, Cheese, Goblin Ear, Bone, Orc Tooth e as 4 relíquias): frames 267–285 do atlas. Os ícones aparecem no paper doll, nos slots de relíquia, no inventário e na loja.
  - Paper doll com ícone do item; slot sem item continua com a sigla do slot. Sprite vira pro lado em que anda ou ataca; flash branco ao apanhar e verde ao curar (tint FILL do Phaser 4); boss enfurecido avermelhado.
- **Movimento animado:** 100 ms por passo (`MOVE_TWEEN_MS`, menor que a repetição de 130 ms do input). A câmera segue a view do Knight a cada frame. O core já está no tile novo: a animação é só apresentação.
- **Screenshake:** golpe pesado no Knight (já existia), fúria do boss, morte do Knight e do boss.
- **Fonte pixel em tudo** (decisão do Felipe): **VT323**, escolhida entre 6 (Pixelify Sans, Silkscreen, Press Start 2P, Tiny5, Jersey 10) por ser a mais legível em texto miúdo (LOG, cartas) e ter acentos. `FONT_SCALE = 1,4` converte os tamanhos do layout antigo. `letterSpacing` 0,5 faz o Phaser desenhar letra por letra, o que desliga a ligadura "fi" da fonte (sem isso "Afiar" aparecia "Añar"). O jogo espera a fonte carregar antes de criar o primeiro texto.
- **Som:** só efeitos (música o Felipe arruma depois), **sintetizados na Web Audio API**: golpe, crítico, dano, kill, morte, arremesso, cura, level up, loot, venda, compra, escada, fúria, invocação, vitória e UI (mover, confirmar, negar). **M / Select = mudo**, salvo em `cryptveil.settings` (fora da meta). O Felipe ainda não comprou o bartop; o Select deve existir.
- **Sanctum:** fundo de cripta (tiles bem escuros) e um ícone por entrada do menu.
- **Rede do ambiente** (02/10/2026): o Felipe pôs o acesso em "Completo" pra liberar o `kenney.nl`. Recomendação registrada: voltar pra "Personalizado" só com os domínios necessários (`kenney.nl`); quando precisar de outro, o Claude explica o que é e por quê antes de pedir.

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
    - **Skills do Knight**, sem cooldown, só mana (**desde o ajuste pós-6b têm recarga**, ver §5) (multiplicadores do Marco 2c): **Brutal Strike** (1 alvo adjacente, ATK×2, 5 mana) · **Berserk** (4 adjacentes, ATK×1,25, 10 mana) · **Whirlwind Throw** (1 alvo em linha reta até 3 tiles, ATK×1,5, 8 mana) · **Wound Cleansing** (cura 25% do HP max, 10 mana). Esses são o nível 1; desde o Marco 2d só o Brutal Strike vem de início e as outras saem em carta (ver §5).
    - **Mana:** 30 max no início. ~~Regenera 1 a cada 2 turnos~~ → desde o Marco 2c, +4 por kill (sem regen por turno). HP não regenera sozinho (só passiva +2 por kill e cura).
    - **XP:** ~~`20 × nível atual`~~ → desde o Marco 2d, `8 + 3 × (nível − 1)`. XP de cada monstro no template.
    - **Gold por kill:** faixa `goldMin`–`goldMax` no template, sorteada pelo `Rng`; todo kill rende ≥ 1.
    - Itens do Marco 2 = só os do Knight da §2.4 com chances provisórias. Inventário sem limite de slots no MVP. Gold fica no `RunState`; conversão em meta só no Marco 5.
  - [x] **Sala explorada** (Marco 2b): o player entrou nela **e** todos os monstros que nasceram nela morreram (sala vazia conta ao entrar). A cada 16 (Marco 2d; era 6 no 2c), o próximo andar ganha uma Training Room.
  - [x] **Poções** (Marco 2b), drop de qualquer monstro, sorteio separado do loot: **HP** 5% de chance, cura 50% do HP max (decisão do Felipe). **Mana** 8% de chance, restaura 50% da mana max: mais comum e mais fraca porque a mana já regenera (no 2b; desde o 2c vem de kill) e 15 de mana ≈ 1,5 Wound Cleansing ≈ 19 HP, menos que a poção de HP. Preço na loja: Marco 4.
  - [x] Marco 4 (decidido em 01/10/2026, números provisórios): loot tables, stats dos monstros, preços, relíquias (eram 2 no plano; o Felipe quis as 4), mercador e boss. Tudo na §5, Marco 4.
  - [x] Marco 5 (decidido em 01/10/2026, números provisórios): custos e efeitos de The Vault, Ancient Armory e Tome of Knowledge; conversão do gold no fim da run. Tudo na §5, Marco 5.
- [x] Passar o turno: Espaço / X (Marco 1).
- [x] Mapeamento das skills no controle (Marco 3): LB/RB + A/B/X/Y (§4.3).
- [x] Empilhamento de DEF (§2.12): resolvido no Marco 6a com a redução percentual.
- [x] **Dificuldade (feedback do Felipe jogando o Marco 4): "pouca dificuldade pra vencer".** Endurecida no Marco 6a (bot sem meta de 41% pra ~14%). Falta o Felipe confirmar jogando.
- [ ] Relíquias por run baixas na simulação (0,3): revisar preços/renda de gold no Marco 6.
- [ ] Custo total do Sanctum (2.490g) vs. renda de gold por run: provavelmente runs demais pra completar. O Felipe manteve os preços no 6a; revisar quando ele jogar mais.
- [ ] **Sprites que faltam** (desenhar no estilo do Tiny Dungeon quando precisar): ícones das skills na hotbar; itens de slots que ainda não têm item no jogo (perneira, botas, anel, amuleto); monstros pós-MVP (Dragon, Lich, Vampire, Demon). O Ghost do §2.9 já tem sprite no pack (121).
- [ ] **Pacote de sprites local** (opcional, só no fliperama): carregar uma pasta fora do repositório no lugar do atlas, se o Felipe quiser sprites próprios em casa.
- [ ] Música (o Felipe arruma uma); quando vier, entra com volume próprio e o mesmo mudo.

---

## 8. Fluxo de trabalho

- Código num repositório GitHub, trabalhado pelo **Claude Code** (claude.ai/code ou app). Um commit/PR por Marco, com `npm run check` verde.
- Repositório público: `github.com/felipekaranb-hub/cryptveil`. Cada push na `main` roda testes + build e publica em **https://felipekaranb-hub.github.io/cryptveil/** (`.github/workflows/deploy.yml`). O Felipe valida cada Marco por esse link, sem instalar nada.
- **Publicação automática** (decidido em 01/10/2026): o Claude Code trabalha numa branch da sessão (`claude/...`) e, ao fechar um Marco com `npm run check` verde, leva os commits pra `main` e confere o deploy. Sem PR pra revisar; regra registrada no `CLAUDE.md`.
- Commits com o e-mail noreply do GitHub (o repositório é público).
- Primeira mensagem de uma instância nova: ler `CLAUDE.md` e este documento, dizer em que Marco o projeto está e apresentar o plano do próximo Marco para aprovação.
