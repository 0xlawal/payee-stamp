export type Hex = `0x${string}`

/**
 * Wire format for a signed invoice. Everything here must survive a round trip
 * through a URL fragment and JSON, so bigint is carried as a decimal string.
 */
export interface InvoicePayload {
  /** Wallet that signed, and the only address this invoice can pay. */
  payee: Hex
  /** Canonical $WIF contract this invoice is denominated in. */
  token: Hex
  /** Raw token amount in base units (18 decimals), as a decimal string. */
  amount: string
  /** Chain the payment must happen on. */
  chainId: number
  /** Random per-invoice identifier. Not onchain replay protection. */
  invoiceId: Hex
  /** Unix seconds. */
  issuedAt: number
  /** Unix seconds. */
  expiresAt: number
  /** keccak256 of the human-readable reference. */
  referenceHash: Hex
  /** Human-readable reference shown to the payer. No personal data. */
  reference: string
}

export interface SignedInvoice {
  payload: InvoicePayload
  signature: Hex
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'idle'

export interface CheckResult {
  id: string
  index: string
  label: string
  detail: string
  status: CheckStatus
  badge: string
}

export interface PayeeRecord {
  address: Hex
  label: string
  firstSeen: number
  lastSeen: number
  paymentCount: number
}

export type PaymentState =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'

export interface PaymentRecord {
  invoiceId: Hex
  payee: Hex
  amount: string
  state: PaymentState
  txHash?: Hex
  updatedAt: number
}
