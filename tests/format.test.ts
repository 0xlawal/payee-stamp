import { describe, expect, it } from 'vitest'
import { formatAmount, parseAmount, shortAddress } from '../src/lib/format'

describe('parseAmount', () => {
  it('parses whole numbers to raw base units', () => {
    expect(parseAmount('8400')).toBe(8400n * 10n ** 18n)
  })

  it('parses decimals', () => {
    expect(parseAmount('1.5')).toBe(15n * 10n ** 17n)
  })

  it('rejects empty and malformed input', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
  })

  it('rejects more precision than the token supports', () => {
    expect(parseAmount('1.' + '1'.repeat(19))).toBeNull()
  })

  it('tolerates thousands separators', () => {
    expect(parseAmount('8,400')).toBe(8400n * 10n ** 18n)
  })
})

describe('formatAmount', () => {
  it('formats whole amounts with thousands separators', () => {
    expect(formatAmount((8400n * 10n ** 18n).toString())).toBe('8,400')
  })

  it('groups very large amounts', () => {
    expect(formatAmount((1234567n * 10n ** 18n).toString())).toBe('1,234,567')
  })

  it('trims trailing zeros in the fraction', () => {
    expect(formatAmount((15n * 10n ** 17n).toString())).toBe('1.5')
  })

  it('round-trips with parseAmount', () => {
    const raw = parseAmount('1234.5678')
    expect(raw).not.toBeNull()
    expect(formatAmount(raw!.toString(), 4)).toBe('1,234.5678')
  })

  it('returns a dash for garbage', () => {
    expect(formatAmount('not-a-number')).toBe('—')
  })
})

describe('shortAddress', () => {
  it('truncates long addresses', () => {
    const out = shortAddress('0x5173b8eA6923c2d40267890D45C46a3480954773')
    expect(out).toContain('…')
    expect(out.length).toBeLessThan(20)
  })
})
