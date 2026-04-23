import { describe, it, expect } from 'vitest'
import { sources } from '@/services/sources'

describe('sources registry', () => {
  it('every source conforms to the DataSource contract', () => {
    for (const [name, source] of Object.entries(sources)) {
      expect(source.id, `${name} must have a stable id`).toBeTypeOf('string')
      expect(source.id.length).toBeGreaterThan(0)
      expect(['public', 'proprietary']).toContain(source.tier)
      expect(source.cacheTtlMs).toBeGreaterThan(0)
      expect(typeof source.fetch).toBe('function')
    }
  })

  it('has unique ids across the registry', () => {
    const ids = Object.values(sources).map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('starts with every source on the public tier', () => {
    for (const source of Object.values(sources)) {
      expect(source.tier).toBe('public')
    }
  })
})
