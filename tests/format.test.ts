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

  it('rejects an amount a uint256 could not hold', () => {
    // The bound is on raw base units, so the whole-token limit sits around 10^59.
    expect(parseAmount('1' + '0'.repeat(60))).toBeNull()
    expect(parseAmount('1' + '0'.repeat(58))).not.toBeNull()
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

  it('never renders a non-zero amount as zero', () => {
    // Anything below the display precision used to collapse to "0", so the pay
    // button offered to send 0 WIF for an amount that was not zero.
    expect(formatAmount('1')).toBe('<0.0001')
    expect(formatAmount((10n ** 13n).toString())).toBe('<0.0001')
  })

  it('keeps a whole amount whole when the fraction is below display precision', () => {
    expect(formatAmount(((1000n * 10n ** 18n) + 1n).toString())).toBe('1,000')
  })
})

describe('shortAddress', () => {
  it('truncates long addresses', () => {
    const out = shortAddress('0x5173b8eA6923c2d40267890D45C46a3480954773')
    expect(out).toContain('…')
    expect(out.length).toBeLessThan(20)
  })
})
