import { describe, expect, it } from 'vitest'
import {
  keccak256,
  pad,
  toHex,
  type Hex,
  type Log,
  type TransactionReceipt,
} from 'viem'
import { verifyReceipt } from '../src/lib/erc20'

/**
 * These tests exist because a "successful" receipt is not evidence that the
 * invoice was paid. Everything below is the gap between the two.
 */

const TRANSFER_TOPIC = keccak256(toHex('Transfer(address,address,uint256)'))

const TOKEN: Hex = '0x5173b8eA6923c2d40267890D45C46a3480954773'
const OTHER_TOKEN: Hex = '0x1111111111111111111111111111111111111111'
const PAYER: Hex = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const PAYEE: Hex = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const STRANGER: Hex = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'

const AMOUNT = 8_400n * 10n ** 18n

const TX_HASH = `0x${'cd'.repeat(32)}` as Hex
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex

function transferLog(
  opts: {
    token?: Hex
    from?: Hex
    to?: Hex
    value?: bigint
    logIndex?: number
  } = {},
): Log {
  return {
    address: opts.token ?? TOKEN,
    topics: [
      TRANSFER_TOPIC,
      pad(opts.from ?? PAYER, { dir: 'left', size: 32 }),
      pad(opts.to ?? PAYEE, { dir: 'left', size: 32 }),
    ],
    data: pad(toHex(opts.value ?? AMOUNT), { dir: 'left', size: 32 }),
    blockHash: BLOCK_HASH,
    blockNumber: 100n,
    logIndex: opts.logIndex ?? 0,
    transactionHash: TX_HASH,
    transactionIndex: 0,
    removed: false,
  } as Log
}

function makeReceipt(
  status: 'success' | 'reverted',
  logs: Log[],
): TransactionReceipt {
  return {
    status,
    logs,
    blockHash: BLOCK_HASH,
    blockNumber: 100n,
    transactionHash: TX_HASH,
    transactionIndex: 0,
    from: PAYER,
    to: TOKEN,
    contractAddress: null,
    cumulativeGasUsed: 21_000n,
    gasUsed: 21_000n,
    effectiveGasPrice: 1n,
    logsBloom: `0x${'00'.repeat(256)}`,
    type: 'eip1559',
  } as unknown as TransactionReceipt
}

const EXPECTED = { token: TOKEN, from: PAYER, to: PAYEE, amount: AMOUNT }

describe('verifyReceipt', () => {
  it('accepts a transfer that matches token, sender, recipient and amount', () => {
    const result = verifyReceipt(makeReceipt('success', [transferLog()]), EXPECTED)
    expect(result).toEqual({ ok: true })
  })

  it('rejects a reverted transaction even when a Transfer log is present', () => {
    const result = verifyReceipt(makeReceipt('reverted', [transferLog()]), EXPECTED)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('Transaction reverted on chain.')
  })

  it('rejects a transfer of the same amount in a different token', () => {
    const receipt = makeReceipt('success', [transferLog({ token: OTHER_TOKEN })])
    const result = verifyReceipt(receipt, EXPECTED)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('does not match')
  })

  it('rejects a transfer to the payee from somebody else', () => {
    const receipt = makeReceipt('success', [transferLog({ from: STRANGER })])
    expect(verifyReceipt(receipt, EXPECTED).ok).toBe(false)
  })

  it('rejects a transfer of the right amount sent to the wrong recipient', () => {
    const receipt = makeReceipt('success', [transferLog({ to: STRANGER })])
    expect(verifyReceipt(receipt, EXPECTED).ok).toBe(false)
  })

  it('rejects a transfer of a different amount to the right recipient', () => {
    const receipt = makeReceipt('success', [transferLog({ value: AMOUNT - 1n })])
    expect(verifyReceipt(receipt, EXPECTED).ok).toBe(false)
  })

  it('rejects a successful transaction with no ERC-20 Transfer log', () => {
    const result = verifyReceipt(makeReceipt('success', []), EXPECTED)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('No ERC-20 Transfer event in this transaction.')
  })

  it('finds the matching transfer among unrelated ones', () => {
    const receipt = makeReceipt('success', [
      transferLog({ token: OTHER_TOKEN, logIndex: 0 }),
      transferLog({ from: STRANGER, logIndex: 1 }),
      transferLog({ logIndex: 2 }),
    ])
    expect(verifyReceipt(receipt, EXPECTED)).toEqual({ ok: true })
  })

  it('compares addresses case-insensitively', () => {
    const receipt = makeReceipt('success', [
      transferLog({
        from: PAYER.toLowerCase() as Hex,
        to: PAYEE.toLowerCase() as Hex,
      }),
    ])
    expect(verifyReceipt(receipt, EXPECTED)).toEqual({ ok: true })
  })

  it('matches the exact raw amount, not a rounded one', () => {
    // 8,400 WIF and 8,400.000000000000000001 WIF must not be interchangeable.
    const receipt = makeReceipt('success', [transferLog({ value: AMOUNT + 1n })])
    expect(verifyReceipt(receipt, EXPECTED).ok).toBe(false)
  })

  describe('with an unknown payer', () => {
    const unknownPayer = { ...EXPECTED, from: null }

    it('accepts a matching transfer when the sender cannot be pinned', () => {
      const receipt = makeReceipt('success', [transferLog()])
      expect(verifyReceipt(receipt, unknownPayer)).toEqual({ ok: true })
    })

    it('still rejects the wrong recipient', () => {
      const receipt = makeReceipt('success', [transferLog({ to: STRANGER })])
      expect(verifyReceipt(receipt, unknownPayer).ok).toBe(false)
    })

    it('still rejects the wrong token', () => {
      const receipt = makeReceipt('success', [transferLog({ token: OTHER_TOKEN })])
      expect(verifyReceipt(receipt, unknownPayer).ok).toBe(false)
    })

    it('still rejects the wrong amount', () => {
      const receipt = makeReceipt('success', [transferLog({ value: 1n })])
      expect(verifyReceipt(receipt, unknownPayer).ok).toBe(false)
    })
  })
})
