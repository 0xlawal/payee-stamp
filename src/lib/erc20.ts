import {
  createPublicClient,
  http,
  parseEventLogs,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import type { Hex } from '../types'
import { robinhoodChain } from './chain'

/** Minimal ERC-20 surface. No approve, no transferFrom, no permit. */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(),
})

export interface ReceiptCheck {
  ok: boolean
  reason?: string
}

/**
 * Verify that a confirmed transaction actually settled the invoice we expect.
 *
 * A receipt status of "success" is not enough: the transaction could have
 * transferred a different token, a different amount, or to a different
 * recipient. We require a Transfer event from the pinned contract, from the
 * payer, to the payee, for the exact raw amount.
 *
 * What this cannot prove: a Transfer event carries no invoice ID, so we cannot
 * show onchain that this transfer settled only this invoice.
 */
export function verifyReceipt(
  receipt: TransactionReceipt,
  expected: { token: Hex; from: Hex; to: Hex; amount: bigint },
): ReceiptCheck {
  if (receipt.status !== 'success') {
    return { ok: false, reason: 'Transaction reverted on chain.' }
  }

  const transfers = parseEventLogs({
    abi: ERC20_ABI,
    eventName: 'Transfer',
    logs: receipt.logs,
  })

  const matching = transfers.find((log) => {
    const args = log.args
    return (
      log.address.toLowerCase() === expected.token.toLowerCase() &&
      args.from?.toLowerCase() === expected.from.toLowerCase() &&
      args.to?.toLowerCase() === expected.to.toLowerCase() &&
      args.value === expected.amount
    )
  })

  if (!matching) {
    const anyTransfer = transfers.length > 0
    return {
      ok: false,
      reason: anyTransfer
        ? 'A Transfer event exists but its token, sender, recipient or amount does not match this invoice.'
        : 'No ERC-20 Transfer event in this transaction.',
    }
  }

  return { ok: true }
}

export async function waitForReceipt(hash: Hash): Promise<TransactionReceipt> {
  return publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
}

export async function readBalance(token: Hex, owner: Hex): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner],
  })
}
