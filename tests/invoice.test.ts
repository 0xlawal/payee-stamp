import { describe, expect, it } from 'vitest'
import {
  decodeInvoice,
  encodeInvoice,
  hashReference,
  randomInvoiceId,
  validatePayload,
} from '../src/lib/eip712'
import { buildChecks, paymentGate } from '../src/lib/verify'
import type { Hex, InvoicePayload, PayeeRecord } from '../src/types'

const PAYEE: Hex = '0x5173b8eA6923c2d40267890D45C46a3480954773'
const OTHER: Hex = '0x0000000000000000000000000000000000000001'
const TOKEN: Hex = '0x5173b8eA6923c2d40267890D45C46a3480954773'
const SIG: Hex = `0x${'11'.repeat(65)}` as Hex

function makePayload(overrides: Partial<InvoicePayload> = {}): InvoicePayload {
  const now = Math.floor(Date.now() / 1000)
  return {
    payee: PAYEE,
    token: TOKEN,
    amount: '1000',
    chainId: 4663,
    invoiceId: randomInvoiceId(),
    issuedAt: now,
    expiresAt: now + 3600,
    referenceHash: hashReference('test invoice'),
    reference: 'test invoice',
    ...overrides,
  }
}

describe('validatePayload', () => {
  it('accepts a well-formed payload', () => {
    expect(validatePayload(makePayload())).not.toBeNull()
  })

  it('rejects a malformed address', () => {
    expect(validatePayload(makePayload({ payee: '0x123' as Hex }))).toBeNull()
  })

  it('rejects a non-numeric amount', () => {
    expect(validatePayload(makePayload({ amount: '12.5' }))).toBeNull()
  })

  it('rejects a bad invoice id length', () => {
    expect(validatePayload(makePayload({ invoiceId: '0xdeadbeef' as Hex }))).toBeNull()
  })

  it('rejects null', () => {
    expect(validatePayload(null)).toBeNull()
  })
})

describe('encode / decode round trip', () => {
  it('preserves every field', () => {
    const payload = makePayload()
    const encoded = encodeInvoice({ payload, signature: SIG })
    const decoded = decodeInvoice(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.payload).toEqual(payload)
    expect(decoded!.signature).toBe(SIG)
  })

  it('rejects a truncated link', () => {
    const encoded = encodeInvoice({ payload: makePayload(), signature: SIG })
    expect(decodeInvoice(encoded.slice(0, encoded.length - 8))).toBeNull()
  })

  it('rejects a bad signature length', () => {
    const encoded = encodeInvoice({ payload: makePayload(), signature: '0x1234' as Hex })
    expect(decodeInvoice(encoded)).toBeNull()
  })
})

describe('buildChecks', () => {
  it('passes the signature check when signer equals payee', () => {
    const checks = buildChecks({
      payload: makePayload(),
      signer: PAYEE,
      savedRecord: undefined,
    })
    const sig = checks.find((c) => c.id === 'signature')!
    expect(sig.status).toBe('pass')
  })

  it('fails the signature check when the signer differs from the payee', () => {
    const checks = buildChecks({
      payload: makePayload(),
      signer: OTHER,
      savedRecord: undefined,
    })
    expect(checks.find((c) => c.id === 'signature')!.status).toBe('fail')
  })

  it('fails when the signer could not be recovered', () => {
    const checks = buildChecks({ payload: makePayload(), signer: null, savedRecord: undefined })
    expect(checks.find((c) => c.id === 'signature')!.status).toBe('fail')
  })

  it('warns on a first-time payee rather than passing it', () => {
    const checks = buildChecks({ payload: makePayload(), signer: PAYEE, savedRecord: undefined })
    const saved = checks.find((c) => c.id === 'saved-record')!
    expect(saved.status).toBe('warn')
    expect(saved.badge).toBe('NEW PAYEE')
  })

  it('flags a changed destination when the saved record differs', () => {
    const savedRecord: PayeeRecord = {
      address: OTHER,
      label: 'Saved',
      firstSeen: 1,
      lastSeen: 1,
      paymentCount: 2,
    }
    const checks = buildChecks({ payload: makePayload(), signer: PAYEE, savedRecord })
    expect(checks.find((c) => c.id === 'destination')!.status).toBe('fail')
    expect(checks.find((c) => c.id === 'destination')!.badge).toBe('CHANGED')
  })

  it('fails an expired invoice', () => {
    const past = Math.floor(Date.now() / 1000) - 10
    const checks = buildChecks({
      payload: makePayload({ expiresAt: past }),
      signer: PAYEE,
      savedRecord: undefined,
    })
    expect(checks.find((c) => c.id === 'expiry')!.status).toBe('fail')
  })

  it('fails a wrong network', () => {
    const checks = buildChecks({
      payload: makePayload({ chainId: 1 }),
      signer: PAYEE,
      savedRecord: undefined,
    })
    expect(checks.find((c) => c.id === 'chain')!.status).toBe('fail')
  })

  it('fails a zero amount', () => {
    const checks = buildChecks({
      payload: makePayload({ amount: '0' }),
      signer: PAYEE,
      savedRecord: undefined,
    })
    expect(checks.find((c) => c.id === 'amount')!.status).toBe('fail')
  })
})

describe('paymentGate', () => {
  it('blocks payment when the contract is unconfirmed', () => {
    const checks = buildChecks({ payload: makePayload(), signer: PAYEE, savedRecord: undefined })
    expect(paymentGate(checks, false).allowed).toBe(false)

  })

  it('blocks payment when any check fails', () => {
    const checks = buildChecks({ payload: makePayload(), signer: OTHER, savedRecord: undefined })
    expect(paymentGate(checks, true).allowed).toBe(false)
  })

  it('allows payment when every check passes', () => {
    const savedRecord: PayeeRecord = {
      address: PAYEE,
      label: 'Saved',
      firstSeen: 1,
      lastSeen: 1,
      paymentCount: 1,
    }
    const checks = buildChecks({ payload: makePayload(), signer: PAYEE, savedRecord })
    expect(paymentGate(checks, true).allowed).toBe(true)
  })
})
