export function page(query: Record<string, string | undefined>): number {
  return parseInt(query?.page || "1", 10)
}
