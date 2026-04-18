interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const memory = new Map<string, CacheEntry<unknown>>()

function now(): number {
  return Date.now()
}

function readPersisted<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(`tw:cache:${key}`)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

function writePersisted<T>(key: string, entry: CacheEntry<T>): void {
  try {
    localStorage.setItem(`tw:cache:${key}`, JSON.stringify(entry))
  } catch {
    // storage full or unavailable — ignore
  }
}

export async function fetchWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const mem = memory.get(key) as CacheEntry<T> | undefined
  if (mem && mem.expiresAt > now()) return mem.value

  const persisted = readPersisted<T>(key)
  if (persisted && persisted.expiresAt > now()) {
    memory.set(key, persisted)
    return persisted.value
  }

  try {
    const value = await fetcher()
    const entry: CacheEntry<T> = { value, expiresAt: now() + ttlMs }
    memory.set(key, entry)
    writePersisted(key, entry)
    return value
  } catch (error) {
    if (persisted) return persisted.value // stale-on-error fallback
    throw error
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return (await res.json()) as T
}
