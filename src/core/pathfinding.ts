import { DIRECTIONS, pointKey, samePoint, step, type Direction, type Point } from './grid';

/**
 * BFS em grid 4-direções. Devolve a PRIMEIRA direção do caminho mais curto
 * de `from` até `to`, ou null se não há caminho.
 *
 * `isPassable` decide quais tiles podem ser atravessados (parede, outros
 * monstros). O destino é sempre aceito — é onde está o alvo do ataque.
 * O Ghost (pós-MVP) passa um isPassable que ignora parede.
 */
export function bfsFirstStep(
  from: Point,
  to: Point,
  isPassable: (p: Point) => boolean,
  maxNodes = 4096,
): Direction | null {
  if (samePoint(from, to)) return null;

  // Para cada tile visitado, guarda a direção do primeiro passo que levou até ele
  const firstStep = new Map<string, Direction>();
  const visited = new Set<string>([pointKey(from)]);
  const queue: Point[] = [];

  for (const dir of DIRECTIONS) {
    const n = step(from, dir);
    if (samePoint(n, to)) return dir;
    if (!isPassable(n)) continue;
    visited.add(pointKey(n));
    firstStep.set(pointKey(n), dir);
    queue.push(n);
  }

  let head = 0;
  while (head < queue.length && visited.size < maxNodes) {
    const cur = queue[head++] as Point;
    const curFirst = firstStep.get(pointKey(cur)) as Direction;
    for (const dir of DIRECTIONS) {
      const n = step(cur, dir);
      const key = pointKey(n);
      if (visited.has(key)) continue;
      if (samePoint(n, to)) return curFirst;
      if (!isPassable(n)) continue;
      visited.add(key);
      firstStep.set(key, curFirst);
      queue.push(n);
    }
  }
  return null;
}
