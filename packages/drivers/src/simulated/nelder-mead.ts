/** Nelder–Mead simplex search: minimises `f` without gradients. Small and deterministic. */
export interface MinimiseOptions {
  /** Size of the first simplex around `start`, added to each coordinate in turn. */
  step?: number;
  maxEvaluations?: number;
  /** Stop when the simplex's best and worst values differ by less than this. */
  tolerance?: number;
}

export interface Minimum {
  point: number[];
  value: number;
  evaluations: number;
}

interface Vertex {
  point: number[];
  value: number;
}

const along = (from: number[], to: number[], t: number): number[] =>
  from.map((x, i) => x + t * ((to[i] ?? 0) - x));

export function minimise(
  f: (point: number[]) => number,
  start: readonly number[],
  { step = 0.1, maxEvaluations = 4000, tolerance = 1e-6 }: MinimiseOptions = {},
): Minimum {
  let evaluations = 0;
  const vertex = (point: number[]): Vertex => {
    evaluations++;
    return { point, value: f(point) };
  };
  const simplex: [Vertex, ...Vertex[]] = [vertex([...start])];
  start.forEach((x, i) => {
    const point = [...start];
    point[i] = x + step;
    simplex.push(vertex(point));
  });

  for (;;) {
    simplex.sort((a, b) => a.value - b.value);
    const best = simplex[0];
    const worst = simplex.at(-1) ?? best;
    if (evaluations >= maxEvaluations || worst.value - best.value < tolerance) break;
    const secondWorst = simplex.at(-2) ?? best;
    const rest = simplex.slice(0, -1);
    const centroid = start.map(
      (_, i) => rest.reduce((sum, v) => sum + (v.point[i] ?? 0), 0) / rest.length,
    );

    const reflected = vertex(along(worst.point, centroid, 2));
    let next: Vertex | undefined;
    if (reflected.value < best.value) {
      const expanded = vertex(along(worst.point, centroid, 3));
      next = expanded.value < reflected.value ? expanded : reflected;
    } else if (reflected.value < secondWorst.value) {
      next = reflected;
    } else {
      const contracted = vertex(along(worst.point, centroid, 0.5));
      if (contracted.value < worst.value) next = contracted;
    }
    if (next) {
      simplex[simplex.length - 1] = next;
      continue;
    }
    // Nothing better along the line: shrink every vertex halfway towards the best.
    const shrunk = simplex.slice(1).map((v) => vertex(along(best.point, v.point, 0.5)));
    simplex.splice(1, Infinity, ...shrunk);
  }
  const best = simplex[0];
  return { point: best.point, value: best.value, evaluations };
}
