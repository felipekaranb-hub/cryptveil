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

CUSTOM = [skeleton, orc, warlord]  # frames 264, 265, 266

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
