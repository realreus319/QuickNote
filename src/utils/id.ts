export function generateLocalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}
