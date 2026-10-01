import { describe, expect, it } from 'vitest';

/**
 * Guarda da arquitetura: o core/ é lógica pura.
 * Se alguém importar Phaser, DOM ou chamar Math.random() aqui, o teste quebra.
 * Isso é o que mantém save/load, testes e simulação de balanceamento baratos.
 */
const sources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Remove comentários pra não acusar menções em documentação. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('arquitetura do core', () => {
  const files = Object.entries(sources);

  it('encontrou os arquivos do core', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s não importa Phaser nem toca no DOM', (_path, code) => {
    const c = stripComments(code);
    expect(c).not.toMatch(/from\s+['"]phaser['"]/);
    expect(c).not.toMatch(/\b(window|document|localStorage)\./);
  });

  it.each(files.filter(([p]) => !p.endsWith('/rng.ts')))(
    '%s não usa Math.random() (use Rng)',
    (_path, code) => {
      expect(stripComments(code)).not.toMatch(/Math\.random\s*\(/);
    },
  );
});
