export async function rows<T>(q: PromiseLike<{ data: T[] | null; error?: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q
  if (error) console.error('query failed:', error.message)
  return data ?? []
}
