import {
  hashTypedData,
  isAddress,
  keccak256,
  recoverTypedDataAddress,
  toHex,
  zeroAddress,
} from 'viem'
import type { Hex, InvoicePayload, SignedInvoice } from '../types'
import { CHAIN_ID, WIF_TOKEN_ADDRESS } from './chain'

/**
 * EIP-712 domain. There is no verifying contract because PayeeStamp holds no
 * onchain contract — this is an offchain attestation of intent, not a permit.
 */
export function invoiceDomain(chainId: number = CHAIN_ID) {
  return {
    name: 'PayeeStamp',
    version: '1',
    chainId,
  } as const
}

export const INVOICE_TYPES = {
  Invoice: [
    { name: 'payee', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'invoiceId', type: 'bytes32' },
    { name: 'issuedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'referenceHash', type: 'bytes32' },
  ],
} as const

export function buildTypedData(payload: InvoicePayload) {
  return {
    domain: invoiceDomain(payload.chainId),
    types: INVOICE_TYPES,
    primaryType: 'Invoice' as const,
    message: {
      payee: payload.payee,
      token: payload.token,
      amount: BigInt(payload.amount),
      chainId: BigInt(payload.chainId),
      invoiceId: payload.invoiceId,
      issuedAt: BigInt(payload.issuedAt),
      expiresAt: BigInt(payload.expiresAt),
      referenceHash: payload.referenceHash,
    },
  }
}

export function hashInvoice(payload: InvoicePayload): Hex {
  return hashTypedData(buildTypedData(payload))
}

/** Recover the address that produced the signature. Throws on malformed input. */
export async function recoverSigner(
  payload: InvoicePayload,
  signature: Hex,
): Promise<Hex> {
  return recoverTypedDataAddress({
    ...buildTypedData(payload),
    signature,
  })
}

export function hashReference(text: string): Hex {
  return keccak256(toHex(text))
}

/** 32 random bytes, used as a per-invoice identifier. */
export function randomInvoiceId(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export function isValidAddress(value: string): boolean {
  return isAddress(value) && value !== zeroAddress
}

/** True when two addresses are the same, case-insensitively. */
export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Structural validation of a payload arriving from a URL. Rejects anything
 * malformed before it reaches signature recovery, so a garbage link produces a
 * readable error rather than a thrown exception.
 */
export function validatePayload(value: unknown): InvoicePayload | null {
  if (typeof value !== 'object' || value === null) return null
  const p = value as Record<string, unknown>

  const hex32 = (v: unknown): v is Hex =>
    typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v)
  const addr = (v: unknown): v is Hex =>
    typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)
  const uint = (v: unknown): v is string =>
    typeof v === 'string' && /^\d+$/.test(v) && v !== ''

  if (!addr(p.payee) || !addr(p.token)) return null
  if (!hex32(p.invoiceId) || !hex32(p.referenceHash)) return null
  if (!uint(p.amount)) return null
  if (typeof p.chainId !== 'number' || !Number.isInteger(p.chainId)) return null
  if (typeof p.issuedAt !== 'number' || !Number.isInteger(p.issuedAt)) return null
  if (typeof p.expiresAt !== 'number' || !Number.isInteger(p.expiresAt)) return null
  if (typeof p.reference !== 'string' || p.reference.length > 200) return null

  return {
    payee: p.payee,
    token: p.token,
    amount: p.amount,
    chainId: p.chainId,
    invoiceId: p.invoiceId,
    issuedAt: p.issuedAt,
    expiresAt: p.expiresAt,
    referenceHash: p.referenceHash,
    reference: p.reference,
  }
}

/* ------------------------------- URL codec ------------------------------- */

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeInvoice(invoice: SignedInvoice): string {
  return toBase64Url(JSON.stringify(invoice))
}

export function decodeInvoice(encoded: string): SignedInvoice | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null

    const payload = validatePayload(parsed.payload)
    if (!payload) return null

    const signature = parsed.signature
    if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
      return null
    }

    return { payload, signature: signature as Hex }
  } catch {
    return null
  }
}

export { WIF_TOKEN_ADDRESS }
