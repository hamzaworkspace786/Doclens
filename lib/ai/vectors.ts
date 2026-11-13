/** Scale a vector to length 1, so that a dot product equals cosine similarity. */
export function normalize(values: ArrayLike<number>): Float32Array {
  let sumOfSquares = 0;
  for (let i = 0; i < values.length; i++) sumOfSquares += values[i] * values[i];

  const length = Math.sqrt(sumOfSquares);
  if (!(length > 0)) throw new Error("Cannot normalize a vector of zeros.");

  const result = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) result[i] = values[i] / length;
  return result;
}

export function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector sizes differ: ${a.length} and ${b.length}.`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
