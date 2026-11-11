import type {
  CheckResult,
  Hex,
  InvoicePayload,
  PayeeRecord,
  ReferenceRecord,
} from '../types'
import { CHAIN_ID, WIF_TOKEN_ADDRESS } from './chain'
import { sameAddress } from './eip712'

export interface VerifyContext {
  payload: InvoicePayload
  /** Recovered signer, or null if recovery failed. */
  signer: Hex | null
  savedRecord: PayeeRecord | undefined
  /**
   * The address that invoiced this same reference last time the payer settled
   * one. A saved payee record cannot answer this: it is looked up by the
   * invoice's own address, so it always agrees with it.
   */
  savedReference?: ReferenceRecord
  now?: number
  /** True while signature recovery is still running. */
  recovering?: boolean
}

/**
 * Every check is deliberately separate. A matching signature is never folded
 * into the same line as a known payee, because one proves key control and the
 * other proves we have seen this address before. Collapsing them would let a
 * green tick imply more than it does.
 */
export function buildChecks(ctx: VerifyContext): CheckResult[] {
  const { payload, signer, savedRecord } = ctx
  const now = ctx.now ?? Math.floor(Date.now() / 1000)

  const checks: CheckResult[] = []

  /* 01 — signature */
  const recovering = ctx.recovering === true
  const signatureOk = signer !== null && sameAddress(signer, payload.payee)
  checks.push({
    id: 'signature',
    index: '01',
    label: 'Invoice signature',
    detail: recovering
      ? 'Recovering the signer from the signature…'
      : signatureOk
        ? 'Typed fields recover to the stated payee address.'
        : signer
          ? 'Signature recovers to a different address than the stated payee.'
          : 'Signature could not be recovered from these fields.',
    status: recovering ? 'idle' : signatureOk ? 'pass' : 'fail',
    badge: recovering ? 'VERIFYING' : signatureOk ? 'MATCH' : 'MISMATCH',
  })

  /* 02 — saved payee record */
  if (!savedRecord) {
    checks.push({
      id: 'saved-record',
      index: '02',
      label: 'Saved payee record',
      detail: 'No record for this address in this browser.',
      status: 'warn',
      badge: 'NEW PAYEE',
    })
  } else {
    checks.push({
      id: 'saved-record',
      index: '02',
      label: 'Saved payee record',
      detail: `Payer's local contact book — saved ${new Date(
        savedRecord.firstSeen * 1000,
      ).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      })}.`,
      status: 'pass',
      badge: 'MATCH',
    })
  }

  /* 03 — destination change */
  // Compared against who invoiced this reference last time, not against the
  // payee's own saved record: that lookup is keyed by the invoice address, so
  // it can never disagree with it and the check could never fire.
  const savedReference = ctx.savedReference
  const changed =
    savedReference !== undefined && !sameAddress(savedReference.payee, payload.payee)
  checks.push({
    id: 'destination',
    index: '03',
    label: 'Destination change',
    detail: changed
      ? 'A different address invoiced this same reference the last time you paid it.'
      : savedReference
        ? 'Matches the address that invoiced this reference before.'
        : 'No earlier paid invoice for this reference in this browser.',
    status: changed ? 'fail' : savedReference ? 'pass' : 'idle',
    badge: changed ? 'CHANGED' : savedReference ? 'NO CHANGE' : 'NO RECORD',
  })

  /* 04 — token contract */
  const tokenConfirmed = WIF_TOKEN_ADDRESS !== null
  const tokenMatches = tokenConfirmed && sameAddress(payload.token, WIF_TOKEN_ADDRESS!)
  checks.push({
    id: 'token',
    index: '04',
    label: 'Token contract',
    detail: tokenMatches
      ? 'Matches the pinned $WIF contract in this build.'
      : tokenConfirmed
        ? 'Invoice names a different token contract than this build pins.'
        : 'This build has no organizer-confirmed $WIF contract, so payment stays disabled.',
    status: tokenMatches ? 'pass' : tokenConfirmed ? 'fail' : 'warn',
    badge: tokenMatches ? 'MATCH' : tokenConfirmed ? 'WRONG TOKEN' : 'NOT CONFIRMED',
  })

  /* 05 — network */
  const chainOk = payload.chainId === CHAIN_ID
  checks.push({
    id: 'chain',
    index: '05',
    label: 'Network',
    detail: chainOk
      ? `Robinhood Chain · ${payload.chainId}`
      : `Invoice is for chain ${payload.chainId}; this app is pinned to ${CHAIN_ID}.`,
    status: chainOk ? 'pass' : 'fail',
    badge: chainOk ? 'MATCH' : 'WRONG NETWORK',
  })

  /* 06 — expiry */
  const expired = payload.expiresAt <= now
  checks.push({
    id: 'expiry',
    index: '06',
    label: 'Expiry',
    detail: expired
      ? 'This invoice is past its expiry and cannot be paid.'
      : `Valid until ${new Date(payload.expiresAt * 1000).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}.`,
    status: expired ? 'fail' : 'pass',
    badge: expired ? 'EXPIRED' : 'VALID',
  })

  /* 07 — amount */
  let amountOk = false
  try {
    amountOk = BigInt(payload.amount) > 0n
  } catch {
    amountOk = false
  }
  checks.push({
    id: 'amount',
    index: '07',
    label: 'Amount',
    detail: amountOk ? 'Non-zero token amount in the signed fields.' : 'Amount is zero or malformed.',
    status: amountOk ? 'pass' : 'fail',
    badge: amountOk ? 'NON-ZERO' : 'INVALID',
  })

  return checks
}

export type PaymentGate =
  | { allowed: true }
  | { allowed: false; reason: string }

/**
 * Payment is allowed only when nothing failed. A warning alone (new payee,
 * unconfirmed contract) is surfaced to the user but does not by itself unlock
 * the action — the caller must also require explicit acknowledgement.
 */
export function paymentGate(checks: CheckResult[], paymentsEnabled: boolean): PaymentGate {
  if (!paymentsEnabled) {
    return {
      allowed: false,
      reason: 'Canonical $WIF contract not confirmed — verification only',
    }
  }

  const failed = checks.find((c) => c.status === 'fail')
  if (failed) {
    return { allowed: false, reason: failed.badge.toLowerCase() }
  }

  return { allowed: true }
}

/** Warnings the payer must explicitly acknowledge before the pay button unlocks. */
export function outstandingWarnings(checks: CheckResult[]): CheckResult[] {
  return checks.filter((c) => c.status === 'warn')
}
