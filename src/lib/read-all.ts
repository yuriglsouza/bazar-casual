type QueryError = { code?: string; message?: string } | null;

// A newly refreshed token can briefly be rejected by PostgREST (PGRST303).
// Retry only that read-only auth failure; other errors still surface immediately.
export async function readWithAuthRetry<T extends { error: QueryError }>(query: () => PromiseLike<T>, label: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await query();
    if (!result.error) return result;
    if (result.error.code === "PGRST303" && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      continue;
    }
    console.error("Falha ao carregar", label, result.error.code ?? "sem código");
    return result;
  }
}

// Stable ordering by a unique key is required on each supplied query.
export async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryError }>, label = "lista") {
  const data: T[] = [];
  for (let from = 0; ; from += 500) {
    const page = await readWithAuthRetry(() => query(from, from + 499), label);
    if (page.error) throw new Error("Não foi possível carregar os dados. Tente novamente.");
    data.push(...(page.data ?? []));
    if (!page.data || page.data.length < 500) return { data, error: null };
  }
}
