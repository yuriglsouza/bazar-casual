// Stable ordering by a unique key is required on each supplied query.
export async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const data: T[] = [];
  for (let from = 0; ; from += 500) {
    const page = await query(from, from + 499);
    if (page.error) throw new Error("Não foi possível carregar os dados. Tente novamente.");
    data.push(...(page.data ?? []));
    if (!page.data || page.data.length < 500) return { data, error: null };
  }
}
