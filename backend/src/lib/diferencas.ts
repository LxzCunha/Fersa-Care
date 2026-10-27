/** Só os nomes: a auditoria diz o que mudou, sem guardar cópia dos dados. */
export function camposAlterados<T extends object>(antes: T, depois: Partial<T>): string[] {
  return (Object.keys(depois) as (keyof T & string)[]).filter(
    (campo) => normalizar(antes[campo]) !== normalizar(depois[campo]),
  );
}

function normalizar(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return 'null';
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return JSON.stringify(valor.map(normalizar).sort());
  return JSON.stringify(valor);
}

export function diferencaDeListas(antes: readonly string[], depois: readonly string[]) {
  const anterior = new Set(antes);
  const nova = new Set(depois);
  return {
    incluidos: [...nova].filter((id) => !anterior.has(id)),
    removidos: [...anterior].filter((id) => !nova.has(id)),
  };
}
