const DECIMALS = 18n

/** Format a raw base-unit amount as a human string, trimming trailing zeros. */
export function formatAmount(raw: string, maxFractionDigits = 4): string {
  let value: bigint
  try {
    value = BigInt(raw)
  } catch {
    return '—'
  }

  const negative = value < 0n
  if (negative) value = -value

  const base = 10n ** DECIMALS
  const whole = value / base
  const fraction = value % base

  let out = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  if (fraction > 0n) {
    let frac = fraction.toString().padStart(Number(DECIMALS), '0')
    // Show at most maxFractionDigits, then strip trailing zeros.
    frac = frac.slice(0, maxFractionDigits).replace(/0+$/, '')
    if (frac.length > 0) out += `.${frac}`
  }

  return negative ? `-${out}` : out
}

/** Parse a human decimal string into raw base units. Returns null if invalid. */
export function parseAmount(input: string): bigint | null {
  const cleaned = input.trim().replace(/,/g, '')
  if (cleaned === '') return null
  if (!/^\d*\.?\d*$/.test(cleaned)) return null

  const [wholePart, fracPart = ''] = cleaned.split('.')
  if (wholePart === '' && fracPart === '') return null
  if (fracPart.length > Number(DECIMALS)) return null

  const whole = wholePart === '' ? '0' : wholePart
  const frac = fracPart.padEnd(Number(DECIMALS), '0')

  try {
    return BigInt(whole) * 10n ** DECIMALS + BigInt(frac)
  } catch {
    return null
  }
}

export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 2) return address
  return `${address.slice(0, lead)}…${address.slice(-tail)}`
}

export function formatTimestamp(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatRelativeExpiry(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = expiresAt - now
  if (diff <= 0) return 'expired'
  if (diff < 3600) return `expires in ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `expires in ${Math.floor(diff / 3600)}h`
  return `expires in ${Math.floor(diff / 86400)}d`
}
