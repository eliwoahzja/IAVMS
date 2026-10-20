export async function rows<T>(q: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  return (await q).data ?? []
}
