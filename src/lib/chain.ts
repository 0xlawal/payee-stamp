import { defineChain } from 'viem'
import type { Hex } from '../types'

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 4663)
export const CHAIN_ID_TESTNET = 46630

const RPC_URL =
  (import.meta.env.VITE_RPC_URL as string | undefined) ??
  'https://rpc.mainnet.chain.robinhood.com'

export const EXPLORER_URL = 'https://robinhoodchain.blockscout.com'

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: EXPLORER_URL },
  },
})

/**
 * The candidate $WIF contract. Verified on-chain as name="World is Flat",
 * symbol="WIF", 18 decimals, on chain 4663.
 *
 * This is NOT organizer-confirmed. A token with the same name and ticker can be
 * deployed by anyone, so a payment is only enabled once the address is supplied
 * through configuration. Absent or malformed config means read-only mode.
 */
export const WIF_TOKEN_ADDRESS: Hex | null = (() => {
  const raw = (import.meta.env.VITE_WIF_TOKEN_ADDRESS as string | undefined)?.trim()
  if (!raw) return null
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) return null
  if (/^0x0{40}$/.test(raw)) return null
  return raw as Hex
})()

export const PAYMENTS_ENABLED = WIF_TOKEN_ADDRESS !== null

/**
 * The candidate contract, verified on-chain as name="World is Flat", symbol="WIF",
 * 18 decimals on chain 4663. Used to compose invoices before organizer
 * confirmation, but never to enable a transfer — that requires WIF_TOKEN_ADDRESS.
 */
export const CANDIDATE_WIF_TOKEN: Hex = '0x5173b8eA6923c2d40267890D45C46a3480954773'

/**
 * The address the sample invoice pays. Its private key is the publicly known
 * development key committed in scripts/make-demo-invoice.mjs, so anything sent
 * there can be swept by anyone who has read this repository. Payment to it is
 * refused even when payments are enabled.
 */
export const SAMPLE_PAYEE: Hex = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

/** Token address written into new invoices. */
export const INVOICE_TOKEN: Hex = WIF_TOKEN_ADDRESS ?? CANDIDATE_WIF_TOKEN

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`
}

export function explorerAddress(address: string): string {
  return `${EXPLORER_URL}/address/${address}`
}
