"""
Monta o atlas de sprites do jogo (public/assets/sprites/atlas.png).

Fontes (todas CC0, Kenney — www.kenney.nl):
  src/tiny-dungeon.png  Tiny Dungeon 1.0  → frames   0–131
  src/tiny-town.png     Tiny Town 1.0     → frames 132–263
Sprites próprios no estilo do pack (desenhados aqui, mesma paleta) → frames 264+

Tiles de 16×16, 12 por linha, sem espaçamento. O jogo desenha a 2× (tile de 32).
Rodar: python3 tools/sprites/build_atlas.py  (precisa de Pillow)
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parent.parent / 'public' / 'assets' / 'sprites' / 'atlas.png'
T = 16
COLS = 12

dungeon = Image.open(HERE / 'src' / 'tiny-dungeon.png').convert('RGBA')
town = Image.open(HERE / 'src' / 'tiny-town.png').convert('RGBA')


def tile(sheet, i):
    x, y = i % COLS, i // COLS
    return sheet.crop((x * T, y * T, x * T + T, y * T + T))


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def from_rows(rows, palette):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    assert len(rows) == T, len(rows)
    for y, row in enumerate(rows):
        assert len(row) == T, (y, row, len(row))
        for x, ch in enumerate(row):
            if ch != '.':
                img.putpixel((x, y), hexc(palette[ch]))
    return img


def recolor(img, mapping):
    out = img.copy()
    px = out.load()
    m = {hexc(k): hexc(v) for k, v in mapping.items()}
    for y in range(T):
        for x in range(T):
            if px[x, y] in m:
                px[x, y] = m[px[x, y]]
    return out


def paint(img, rows, palette):
    """Sobrescreve pixels (o '.' mantém o que já estava)."""
    out = img.copy()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                out.putpixel((x, y), hexc(palette[ch]) if palette[ch] else (0, 0, 0, 0))
    return out


OUTLINE = '#3f2631'

# ---------------------------------------------------------------- Skeleton
skeleton = from_rows([
    '................',
    '....aaaaaaaa....',
    '...aaxwwwwwwaa..',
    '..aawwwwwwwwaa..',
    '..aawwwwwwwwaa..',
    '..aaweewweewaa..',
    '..aaweewweewaa..',
    '..aagwwhhwwgaa..',
    '..aaagwhwhwgaaa.',
    '...aaaggggaaa...',
    '.aaaaahwwhaaaaa.',
    'aaawwahwwhawwaaa',
    'aawgaahhhhaagwaa',
    'aawaaawhhwaaawaa',
    'aaaaaawaawaaaaaa',
    '.aaaaawaawaaaaa.',
], {'a': OUTLINE, 'w': '#c0cbdc', 'x': '#ffffff', 'g': '#8b9bb4', 'h': '#52607c', 'e': '#262b44'})

# ------------------------------------------------------------- Orc (a partir do 109)
# O 109 do pack é um ciclope careca: pele verde, dois olhos e presas = Orc.
base = tile(dungeon, 109)
orc_skin = {'#f7c282': '#7fbf5a', '#e19a65': '#4f8a3a'}
two_eyes = [
    '................', '................', '................', '................',
    '................', '................',
    '....cdfccdfc....',
    '....cccccccc....',
    '.....dcccdc.....',
]
orc = paint(recolor(base, orc_skin), two_eyes, {'c': '#7fbf5a', 'd': '#ffffff', 'f': '#262b44'})

# ------------------------------------------------- Orc Warlord: Orc mais escuro, chifres e armadura vermelha
warlord = recolor(base, {'#f7c282': '#5e9a48', '#e19a65': '#3a6b2f', '#bd6c4a': '#a22633', '#763b36': '#6b1d26'})
warlord = paint(warlord, [
    '.aak....aaaakaa.',
    'aakk.aaaaaa.kkaa',
    '.akka........kka',
    '...ak........ka.',
    '................', '................',
    '....cdrccdrc....',
    '....cccccccc....',
    '.....dcccdc.....',
], {'a': OUTLINE, 'k': '#e8e2d4', 'c': '#5e9a48', 'd': '#ffffff', 'r': '#e43b44'})

# ------------------------------------------------- Rat de perfil (o 124 do pack, visto de cima, não lia)
rat = from_rows([
    '................', '................', '................', '................',
    '................', '................',
    '...........aa...',
    '..........amma..',
    '....aaaaaaammma.',
    '...aGGGGGGGmmka.',
    '..aGGGGGGGGGmmpa',
    '.aGgGGGGGGGGGaa.',
    'aaagggggggggga..',
    'p..aaapaaapaa...',
    '................', '................',
], {'a': OUTLINE, 'G': '#8b9bb4', 'g': '#5a6988', 'm': '#fec99c', 'p': '#ff706d', 'k': '#262b44'})

# ------------------------------------------------- Goblin (o 112 com pele verde e bandana vermelha)
goblin = recolor(tile(dungeon, 112), {
    '#f7c282': '#b5c95a', '#e19a65': '#7a9238',
    '#43e1b3': '#ff706d', '#25956a': '#e84537',
})

# ------------------------------------------------- ícones de item (16 px, centralizados)
EMPTY = '................'


def armor(main, detail, belt, chain=False):
    body = 'XYXYXYXY' if chain else 'XXYYYYXX'
    return from_rows([
        EMPTY, EMPTY,
        '...aaaa..aaaa...',
        '..aXXXaaaaXXXa..',
        '..aXXXXXXXXXXa..',
        '..aaXXXXXXXXaa..',
        f'...a{body}a...',
        f'...a{"YXYXYXYX" if chain else "XXXXXXXX"}a...',
        f'...a{body}a...',
        f'...a{"YXYXYXYX" if chain else "XXXXXXXX"}a...',
        '...aZZZZZZZZa...',
        '...aXXXXXXXXa...',
        '...aXXXaaXXXa...',
        '...aaaa..aaaa...',
        EMPTY, EMPTY,
    ], {'a': OUTLINE, 'X': main, 'Y': detail, 'Z': belt})


leather = armor('#cf8254', '#bd6c4a', '#763b36')
chain = armor('#8b9bb4', '#c0cbdc', '#52607c', chain=True)
plate = armor('#c0cbdc', '#ffffff', '#feae34')

iron_helmet = from_rows([
    EMPTY, EMPTY, EMPTY,
    '.....aaaaaa.....',
    '....aXXXXXXa....',
    '...aXYXXXXXXa...',
    '...aXYXXXXXXa...',
    '...aXXXXXXXXa...',
    '...aZZZZZZZZa...',
    '...aXaaaaaaXa...',
    '...aXa....aXa...',
    '...aaa....aaa...',
    EMPTY, EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'X': '#8b9bb4', 'Y': '#c0cbdc', 'Z': '#5a6988'})

knight_helmet = from_rows([
    '......aaa.......',
    '.....arrra......',
    '.....arpra......',
    '....aaaraaaa....',
    '...aXXXXXXXXa...',
    '...aXYXXXXXXa...',
    '...aXYXXXXXXa...',
    '...akkkkkkkka...',
    '...aXXkXXkXXa...',
    '...aXXXXXXXXa...',
    '....aaaaaaaa....',
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'X': '#c0cbdc', 'Y': '#ffffff', 'k': '#262b44', 'r': '#e84537', 'p': '#ff706d'})

crown_helmet = from_rows([
    EMPTY,
    '...a...aa...a...',
    '...aa.ayya.aa...',
    '...ayaayyaaya...',
    '...ayyyyyyyya...',
    '...aYYYrrYYYa...',
    '...aaaaaaaaaa...',
    '...aXXXXXXXXa...',
    '...aXkkkkkkXa...',
    '...aXXXXXXXXa...',
    '....aaaaaaaa....',
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'y': '#fee761', 'Y': '#feae34', 'r': '#e84537', 'X': '#c0cbdc', 'k': '#262b44'})

tower_shield = from_rows([
    EMPTY,
    '....aaaaaaaa....',
    '....awggggma....',
    '....aggggmma....',
    '....aggggmma....',
    '....aggyygma....',
    '....aggyygma....',
    '....aggggmma....',
    '....aggggmma....',
    '....aggggmma....',
    '....amggggma....',
    '.....aggmma.....',
    '......aaaa......',
    EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'w': '#ffffff', 'g': '#c0cbdc', 'm': '#8b9bb4', 'y': '#feae34'})

demon_shield = from_rows([
    EMPTY,
    '..a..........a..',
    '..aa........aa..',
    '..awa.aaaa.awa..',
    '...awaRRRRawa...',
    '....aRrrrrRa....',
    '....aRkrrkRa....',
    '....aRrrrrRa....',
    '....aRrkkrRa....',
    '.....aRrrRa.....',
    '......aRRa......',
    '.......aa.......',
    EMPTY, EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'w': '#e4edf9', 'R': '#a22633', 'r': '#e84537', 'k': '#262b44'})

# Magic Sword: a espada larga (106) com lâmina azul
magic_sword = recolor(tile(dungeon, 106), {'#c0cbdc': '#75e3ff', '#8b9bb4': '#0099db'})

cheese = from_rows([
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    '........aaa.....',
    '......aayyya....',
    '....aayyyyyya...',
    '...ayyyyyyyyya..',
    '...aYYYYYkYYYa..',
    '...aYkYYYYYYYa..',
    '...aaaaaaaaaaa..',
    EMPTY, EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'y': '#fee761', 'Y': '#feae34', 'k': '#cf8254'})

goblin_ear = from_rows([
    EMPTY, EMPTY, EMPTY,
    '..........aa....',
    '.........aGa....',
    '........aGga....',
    '.......aGgga....',
    '......aGgga.....',
    '.....aGgdga.....',
    '....aGggdga.....',
    '....aGgggga.....',
    '.....aaGgga.....',
    '.......aaa......',
    EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'G': '#b5c95a', 'g': '#7a9238', 'd': '#763b36'})

bone = from_rows([
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    '..aa........aa..',
    '.awwa......awwa.',
    '.awwwaaaaaawwwa.',
    '..awwwwwwwwwwa..',
    '..agggggggggga..',
    '.awwgaaaaaagwwa.',
    '.awwa......awwa.',
    '..aa........aa..',
    EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'w': '#e4edf9', 'g': '#c0cbdc'})

orc_tooth = from_rows([
    EMPTY, EMPTY, EMPTY,
    '.......aaa......',
    '......awwwa.....',
    '......awwwa.....',
    '......awwga.....',
    '.......awwga....',
    '.......awwga....',
    '........awga....',
    '........awga....',
    '.........aga....',
    '..........a.....',
    EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'w': '#fec99c', 'g': '#eaa56c'})

# ------------------------------------------------- relíquias
idol = from_rows([
    EMPTY, EMPTY,
    '......aaaa......',
    '.....ayyyya.....',
    '.....aykyka.....',
    '.....ayyyya.....',
    '....aaYyyYaa....',
    '...aYyyyyyyYa...',
    '....aYyyyyYa....',
    '....aYyyyyYa....',
    '...aaYYYYYYaa...',
    '...aYYYYYYYYa...',
    '...aaaaaaaaaa...',
    EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'y': '#fee761', 'Y': '#feae34', 'k': '#763b36'})

watcher_eye = from_rows([
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    '.....aaaaaa.....',
    '...aawwwwwwaa...',
    '..awwwnnnnwwwa..',
    '.awwwnNkkNnwwwa.',
    '.awwwnNkkNnwwwa.',
    '..awwwnnnnwwwa..',
    '...aawwwwwwaa...',
    '.....aaaaaa.....',
    EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'w': '#ffffff', 'n': '#0099db', 'N': '#75e3ff', 'k': '#262b44'})

blood_stone = from_rows([
    EMPTY, EMPTY, EMPTY,
    '.....aaaaaa.....',
    '....apprrrRa....',
    '...appprrrrRa...',
    '..aaaaaaaaaaaa..',
    '...arrrrrrrRa...',
    '....arrrrrRa....',
    '.....arrrRa.....',
    '......arRa......',
    '.......aa.......',
    EMPTY, EMPTY, EMPTY, EMPTY,
], {'a': OUTLINE, 'p': '#ff706d', 'r': '#e84537', 'R': '#a22633'})

war_totem = from_rows([
    EMPTY,
    '......aaaa......',
    '.....abbbba.....',
    '.....akbbka.....',
    '.....abrrba.....',
    '...aaabbbbaaa...',
    '...accabbacca...',
    '...aaabbbbaaa...',
    '.....akbbka.....',
    '.....abwwba.....',
    '.....abbbba.....',
    '.....abddba.....',
    '.....abbbba.....',
    '......aaaa......',
    EMPTY, EMPTY,
], {'a': OUTLINE, 'b': '#cf8254', 'c': '#bd6c4a', 'd': '#763b36', 'r': '#e84537', 'w': '#ffffff', 'k': '#262b44'})

# Ordem = frame (264 + índice). Só acrescentar no fim: mudar a ordem troca os sprites.
CUSTOM = [
    skeleton, orc, warlord, rat, goblin,                      # 264–268
    leather, chain, plate,                                    # 269–271
    iron_helmet, knight_helmet, crown_helmet,                 # 272–274
    tower_shield, demon_shield, magic_sword,                  # 275–277
    cheese, goblin_ear, bone, orc_tooth,                      # 278–281
    idol, watcher_eye, blood_stone, war_totem,                # 282–285
]

rows = 11 + 11 + (len(CUSTOM) + COLS - 1) // COLS
atlas = Image.new('RGBA', (COLS * T, rows * T), (0, 0, 0, 0))
atlas.paste(dungeon, (0, 0))
atlas.paste(town, (0, 11 * T))
for k, img in enumerate(CUSTOM):
    i = 264 + k
    atlas.paste(img, ((i % COLS) * T, (i // COLS) * T))
OUT.parent.mkdir(parents=True, exist_ok=True)
atlas.save(OUT)
print('atlas', atlas.size, '→', OUT)
