# Cryptveil

Roguelite por turnos no navegador, inspirado em Tibia.
TypeScript + Phaser 4 + Vite.

**Jogar:** https://felipekaranb-hub.github.io/cryptveil/ (atualiza sozinho a cada push na `main`)

## Rodar

Precisa de Node.js 20.19+ (recomendado 22 ou mais novo).

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. Para repetir uma run específica: `http://localhost:3000/?seed=48213`.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run check` | Typecheck + testes |
| `npm test` | Só os testes |
| `npm run build` | Build estático em `dist/` |
| `npm run preview` | Serve o build |

## Estado

Marco 0 (setup base) entregue. Plano completo em [`docs/HANDOFF.md`](docs/HANDOFF.md).
