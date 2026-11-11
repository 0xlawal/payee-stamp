import { describe, expect, it } from 'vitest'
import { buildChecks, paymentGate } from '../src/lib/verify'
import type { Hex, InvoicePayload, PayeeRecord, ReferenceRecord } from '../src/types'

const PAYEE: Hex = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const OTHER: Hex = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const TOKEN: Hex = '0x5173b8eA6923c2d40267890D45C46a3480954773'
const REF_HASH: Hex = `0x${'ab'.repeat(32)}`

const NOW = 1_850_000_000

const payload: InvoicePayload = {
  payee: PAYEE,
  token: TOKEN,
  amount: '1000',
  chainId: 4663,
  invoiceId: `0x${'cd'.repeat(32)}`,
  issuedAt: 1_800_000_000,
  expiresAt: 1_900_000_000,
  referenceHash: REF_HASH,
  reference: 'October build support',
}

function reference(payee: Hex): ReferenceRecord {
  return { referenceHash: REF_HASH, payee, firstSeen: 1, lastSeen: 2 }
}

function checksWith(opts: {
  savedRecord?: PayeeRecord
  savedReference?: ReferenceRecord
}) {
  return buildChecks({
    payload,
    signer: PAYEE,
    savedRecord: opts.savedRecord,
    savedReference: opts.savedReference,
    now: NOW,
  })
}

function destination(opts: { savedReference?: ReferenceRecord }) {
  return checksWith(opts).find((c) => c.id === 'destination')!
}

describe('check 03 — destination change', () => {
  it('is idle when this reference has never been settled', () => {
    const c = destination({})
    expect(c.status).toBe('idle')
    expect(c.badge).toBe('NO RECORD')
  })

  it('passes when the same address invoiced this reference before', () => {
    const c = destination({ savedReference: reference(PAYEE) })
    expect(c.status).toBe('pass')
    expect(c.badge).toBe('NO CHANGE')
  })

  it('fails when a different address invoiced the same reference', () => {
    const c = destination({ savedReference: reference(OTHER) })
    expect(c.status).toBe('fail')
    expect(c.badge).toBe('CHANGED')
  })

  it('compares addresses case-insensitively', () => {
    const c = destination({ savedReference: reference(PAYEE.toLowerCase() as Hex) })
    expect(c.status).toBe('pass')
  })

  it('blocks payment once the destination has changed', () => {
    const checks = checksWith({ savedReference: reference(OTHER) })
    const gate = paymentGate(checks, true)
    expect(gate.allowed).toBe(false)
    if (!gate.allowed) expect(gate.reason).toBe('changed')
  })

  it('cannot be satisfied by a payee record for the invoice address itself', () => {
    // The regression this guards. A saved payee record is looked up *by* the
    // invoice's own address, so it always agrees with it: the check used to be
    // structurally incapable of reporting a change.
    const checks = checksWith({
      savedRecord: {
        address: PAYEE,
        label: 'Saved payee',
        firstSeen: 1,
        lastSeen: 2,
        paymentCount: 3,
      },
    })
    expect(checks.find((c) => c.id === 'destination')!.status).toBe('idle')
  })
})

describe('check 02 — saved payee record', () => {
  it('warns for a payee never seen before', () => {
    const c = checksWith({}).find((x) => x.id === 'saved-record')!
    expect(c.status).toBe('warn')
    expect(c.badge).toBe('NEW PAYEE')
  })

  it('passes for a known payee', () => {
    const c = checksWith({
      savedRecord: {
        address: PAYEE,
        label: 'Saved payee',
        firstSeen: 1,
        lastSeen: 2,
        paymentCount: 0,
      },
    }).find((x) => x.id === 'saved-record')!
    expect(c.status).toBe('pass')
  })
})
