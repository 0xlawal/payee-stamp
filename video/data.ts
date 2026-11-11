/**
 * Demo data for the Remotion video.
 *
 * The check rows below mirror what `buildChecks()` in src/lib/verify.ts returns
 * for DEMO_INVOICE in a fresh browser. They are written out by hand rather than
 * imported because verify.ts pulls in chain.ts, which reads Vite's
 * `import.meta.env` — an API Remotion's bundler does not provide.
 *
 * Keep these strings in sync with src/lib/verify.ts if the copy changes.
 */
import type { CheckResult, InvoicePayload } from '../src/types'
import { DEMO_INVOICE } from '../src/demo/demoInvoice'

export const PAYLOAD: InvoicePayload = DEMO_INVOICE!.payload

const expiry = new Date(PAYLOAD.expiresAt * 1000).toLocaleString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Check 01 while signature recovery is still running. */
export const RECOVERING_CHECK: CheckResult = {
  id: 'signature',
  index: '01',
  label: 'Invoice signature',
  detail: 'Recovering the signer from the signature…',
  status: 'idle',
  badge: 'VERIFYING',
}

/** Check 01 once recovery finishes — this demo signature does recover. */
export const SIGNATURE_CHECK: CheckResult = {
  id: 'signature',
  index: '01',
  label: 'Invoice signature',
  detail: 'Typed fields recover to the stated payee address.',
  status: 'pass',
  badge: 'MATCH',
}

export const TRAILING_CHECKS: CheckResult[] = [
  {
    id: 'saved-record',
    index: '02',
    label: 'Saved payee record',
    detail: 'No record for this address in this browser.',
    status: 'warn',
    badge: 'NEW PAYEE',
  },
  {
    id: 'destination',
    index: '03',
    label: 'Destination change',
    detail: 'Nothing saved to compare against.',
    status: 'idle',
    badge: 'NO RECORD',
  },
  {
    id: 'token',
    index: '04',
    label: 'Token contract',
    detail:
      'This build has no organizer-confirmed $WIF contract, so payment stays disabled.',
    status: 'warn',
    badge: 'NOT CONFIRMED',
  },
  {
    id: 'chain',
    index: '05',
    label: 'Network',
    detail: 'Robinhood Chain · 4663',
    status: 'pass',
    badge: 'MATCH',
  },
  {
    id: 'expiry',
    index: '06',
    label: 'Expiry',
    detail: `Valid until ${expiry}.`,
    status: 'pass',
    badge: 'VALID',
  },
  {
    id: 'amount',
    index: '07',
    label: 'Amount',
    detail: 'Non-zero token amount in the signed fields.',
    status: 'pass',
    badge: 'NON-ZERO',
  },
]

/** The four facts the payee actually signed, for the invoice beat. */
export const SIGNED_FIELDS: Array<{ label: string; value: string }> = [
  { label: 'Amount', value: '8,400 WIF' },
  { label: 'Token', value: '0x5173…4773' },
  { label: 'Chain', value: '4663 · Robinhood' },
  { label: 'Payee', value: '0x7099…79C8' },
]
