import { useMemo, useState } from 'react'
import {
  encodeInvoice,
  hashReference,
  isValidAddress,
  randomInvoiceId,
} from '../lib/eip712'
import { CHAIN_ID, INVOICE_TOKEN, PAYMENTS_ENABLED } from '../lib/chain'
import { parseAmount, formatAmount } from '../lib/format'
import { useWallet } from '../lib/wallet'
import type { Hex, InvoicePayload, SignedInvoice } from '../types'
import { CopyButton, Field, Notice } from '../components/ui'

const EXPIRY_OPTIONS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
]

export function CreateScreen() {
  const wallet = useWallet()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [expiryHours, setExpiryHours] = useState(72)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SignedInvoice | null>(null)

  const parsedAmount = useMemo(() => parseAmount(amount), [amount])
  const recipientIsValid = isValidAddress(recipient)
  const canSign =
    recipientIsValid &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    reference.trim().length > 0 &&
    wallet.address !== null &&
    !signing

  async function handleSign() {
    if (!wallet.walletClient || !wallet.address || parsedAmount === null) return

    setSigning(true)
    setError(null)
    try {
      const now = Math.floor(Date.now() / 1000)
      const payload: InvoicePayload = {
        payee: recipient as Hex,
        token: INVOICE_TOKEN,
        amount: parsedAmount.toString(),
        chainId: CHAIN_ID,
        invoiceId: randomInvoiceId(),
        issuedAt: now,
        expiresAt: now + expiryHours * 3600,
        referenceHash: hashReference(reference.trim()),
        reference: reference.trim(),
      }

      const signature = await wallet.walletClient.signTypedData({
        account: wallet.address,
        domain: { name: 'PayeeStamp', version: '1', chainId: CHAIN_ID },
        types: {
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
        },
        primaryType: 'Invoice',
        message: {
          payee: payload.payee,
          token: payload.token,
          amount: parsedAmount,
          chainId: BigInt(payload.chainId),
          invoiceId: payload.invoiceId,
          issuedAt: BigInt(payload.issuedAt),
          expiresAt: BigInt(payload.expiresAt),
          referenceHash: payload.referenceHash,
        },
      })

      setResult({ payload, signature })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing was cancelled.')
    } finally {
      setSigning(false)
    }
  }

  const shareLink =
    result && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#i=${encodeInvoice(result)}`
      : ''

  if (result) {
    return (
      <div className="workbench">
        <div className="panel">
          <div className="panel__head">
            <span>Invoice signed</span>
            <span className="right">Share this link</span>
          </div>
          <div className="panel__body">
            <Notice tone="info">
              You signed an offchain message. No token moved, no gas was spent, and no
              allowance was granted.
            </Notice>

            <Field label="Shareable invoice link">
              <input className="input" readOnly value={shareLink} onFocus={(e) => e.target.select()} />
            </Field>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <CopyButton value={shareLink} label="Copy link" />
              <a className="receipt__link" href={`#i=${encodeInvoice(result)}`}>
                Open as payer ↗
              </a>
            </div>

            <div className="addr-strip" style={{ background: '#e4e4d8' }}>
              <span className="addr-strip__value">
                {formatAmount(result.payload.amount)} WIF → {result.payload.payee}
              </span>
            </div>

            <div className="actions">
              <button
                className="btn btn--ghost"
                onClick={() => {
                  setResult(null)
                  setAmount('')
                  setReference('')
                }}
              >
                Create another invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="workbench">
      <div className="panel">
        <div className="panel__head">
          <span>Payee / Create invoice</span>
          <span className="right">
            {wallet.address ? 'Wallet connected' : 'Connect to sign'}
          </span>
        </div>
        <div className="panel__body">
          {!PAYMENTS_ENABLED ? (
            <Notice tone="warn">
              This build pins no organizer-confirmed $WIF contract. You can still sign
              and share an invoice for testing, but payers cannot send funds until the
              contract is confirmed.
            </Notice>
          ) : null}

          <Field
            label="Pay to"
            hint="The wallet that should receive the payment. This is what the payer's checks compare against."
          >
            <input
              className="input"
              placeholder="0x…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              spellCheck={false}
            />
          </Field>

          {wallet.address ? (
            <button
              type="button"
              className="copy-btn"
              style={{ marginBottom: 16 }}
              onClick={() => setRecipient(wallet.address!)}
            >
              Use my connected wallet
            </button>
          ) : null}

          <div className="row">
            <Field label="Amount (WIF)" hint={parsedAmount !== null ? `= ${formatAmount(parsedAmount.toString())} WIF` : undefined}>
              <input
                className="input"
                placeholder="8400"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </Field>

            <Field label="Valid for">
              <select
                className="input"
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.hours} value={opt.hours}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Reference"
            hint="A short description shown to the payer. Do not put personal data in it — it travels in the link."
          >
            <input
              className="input input--text"
              placeholder="October build support"
              value={reference}
              maxLength={120}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>

          {error ? <Notice tone="fail">{error}</Notice> : null}

          <div className="actions">
            {wallet.address === null ? (
              <button
                className="btn btn--primary"
                onClick={() => void wallet.connect()}
                disabled={wallet.connecting}
              >
                {wallet.connecting ? 'Connecting…' : 'Connect wallet to sign'}
                <span className="btn__sub">Signature only · no gas · no approval</span>
              </button>
            ) : (
              <button
                className="btn btn--primary"
                onClick={() => void handleSign()}
                disabled={!canSign}
              >
                {signing ? 'Confirm in your wallet…' : 'Sign invoice'}
                <span className="btn__sub">
                  {recipientIsValid ? 'Offchain EIP-712 signature' : 'Enter a valid payee address'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <aside>
        <div className="panel">
          <div className="panel__head">
            <span>What gets signed</span>
          </div>
          <div className="panel__body" style={{ paddingTop: 10 }}>
            <p className="check__detail" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              The payee address, token contract, exact raw amount, chain, invoice ID,
              issue time, expiry, and a hash of the reference. The payer sees every one
              of those fields before their wallet opens.
            </p>
            <Notice tone="info">
              Signing proves you control this key. It does not prove your legal name, and
              it does not move funds.
            </Notice>
          </div>
        </div>
      </aside>
    </div>
  )
}
