import { useEffect, useMemo, useState } from 'react'
import { decodeInvoice, recoverSigner } from '../lib/eip712'
import { buildChecks, outstandingWarnings, paymentGate } from '../lib/verify'
import { CHAIN_ID, PAYMENTS_ENABLED, WIF_TOKEN_ADDRESS } from '../lib/chain'
import { ERC20_ABI, verifyReceipt, waitForReceipt } from '../lib/erc20'
import { formatAmount } from '../lib/format'
import { getPayment, getPayeeRecord, savePayee, setPayment } from '../lib/local-store'
import { useWallet } from '../lib/wallet'
import type { Hex } from '../types'
import { InvoiceSheet } from '../components/InvoiceSheet'
import { CheckList } from '../components/CheckList'
import { ReceiptCard } from '../components/ReceiptCard'
import { Notice, Stamp } from '../components/ui'

type PayPhase = 'idle' | 'signing' | 'pending' | 'paid' | 'failed'

export function ReviewScreen({ encoded }: { encoded: string }) {
  const invoice = useMemo(() => decodeInvoice(encoded), [encoded])

  const [signer, setSigner] = useState<Hex | null>(null)
  const [recovering, setRecovering] = useState(true)
  const [phase, setPhase] = useState<PayPhase>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ack, setAck] = useState(false)

  const wallet = useWallet()

  useEffect(() => {
    if (!invoice) {
      setRecovering(false)
      return
    }
    let cancelled = false
    setRecovering(true)
    recoverSigner(invoice.payload, invoice.signature)
      .then((addr) => {
        if (!cancelled) setSigner(addr)
      })
      .catch(() => {
        if (!cancelled) setSigner(null)
      })
      .finally(() => {
        if (!cancelled) setRecovering(false)
      })
    return () => {
      cancelled = true
    }
  }, [invoice])

  if (!invoice) {
    return (
      <div className="panel">
        <div className="panel__head">
          <span>Invoice</span>
          <span className="right">Unreadable</span>
        </div>
        <div className="panel__body">
          <Notice tone="fail">
            This invoice link is malformed or truncated. Ask the payee to resend the
            full link. Nothing was verified.
          </Notice>
          <div className="actions">
            <a className="btn btn--ghost" href="#/">
              Back to start
            </a>
          </div>
        </div>
      </div>
    )
  }

  const savedRecord = getPayeeRecord(invoice.payload.payee)
  const checks = buildChecks({
    payload: invoice.payload,
    signer: recovering ? null : signer,
    savedRecord,
  })

  const gate = paymentGate(checks, PAYMENTS_ENABLED)
  const warnings = outstandingWarnings(checks)
  const priorPayment = getPayment(invoice.payload.invoiceId)
  const alreadyPaid = priorPayment?.state === 'paid'

  const wrongNetwork = wallet.address !== null && wallet.chainId !== CHAIN_ID
  const canPay =
    gate.allowed &&
    wallet.address !== null &&
    !wrongNetwork &&
    !alreadyPaid &&
    (warnings.length === 0 || ack) &&
    phase !== 'pending' &&
    phase !== 'signing'

  async function handlePay() {
    if (!invoice || !wallet.walletClient || !wallet.address || !WIF_TOKEN_ADDRESS) return

    setError(null)
    setPhase('signing')
    try {
      const hash = await wallet.walletClient.writeContract({
        address: WIF_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [invoice.payload.payee, BigInt(invoice.payload.amount)],
        account: wallet.address,
        chain: wallet.walletClient.chain,
      })

      setTxHash(hash)
      setPhase('pending')
      setPayment(invoice.payload.invoiceId, {
        state: 'pending',
        payee: invoice.payload.payee,
        amount: invoice.payload.amount,
        txHash: hash,
      })

      const receipt = await waitForReceipt(hash)
      const check = verifyReceipt(receipt, {
        token: invoice.payload.token,
        from: wallet.address,
        to: invoice.payload.payee,
        amount: BigInt(invoice.payload.amount),
      })

      if (!check.ok) {
        setError(check.reason ?? 'Receipt did not match this invoice.')
        setPhase('failed')
        setPayment(invoice.payload.invoiceId, {
          state: 'failed',
          payee: invoice.payload.payee,
          amount: invoice.payload.amount,
          txHash: hash,
        })
        return
      }

      savePayee(invoice.payload.payee)
      setPayment(invoice.payload.invoiceId, {
        state: 'paid',
        payee: invoice.payload.payee,
        amount: invoice.payload.amount,
        txHash: hash,
      })
      setPhase('paid')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'The wallet did not complete the transfer.'
      setError(message)
      setPhase('failed')
    }
  }

  return (
    <div className="workbench">
      <div>
        <div className="panel">
          <div className="panel__head">
            <span>PayeeStamp / Review</span>
            <span className="right">
              {recovering ? 'Verifying…' : 'Read only until checks pass'}
            </span>
          </div>
          <div className="panel__body">
            <InvoiceSheet payload={invoice.payload} />

            <Stamp
              state={
                phase === 'paid'
                  ? 'Paid and receipt verified'
                  : alreadyPaid
                    ? 'Already paid in this browser'
                    : gate.allowed
                      ? 'Checks passed'
                      : gate.reason
              }
              variant={
                phase === 'paid' || alreadyPaid ? 'paid' : gate.allowed ? 'default' : 'locked'
              }
              serial={`INV ${invoice.payload.invoiceId.slice(2, 10).toUpperCase()}`}
            />

            {phase === 'paid' && txHash ? <ReceiptCard hash={txHash} /> : null}

            {phase === 'pending' ? (
              <Notice tone="info">
                Transaction submitted. Waiting for the chain to confirm it. This is not
                paid until the receipt verifies.
              </Notice>
            ) : null}

            {error ? <Notice tone="fail">{error}</Notice> : null}

            {!PAYMENTS_ENABLED ? (
              <Notice tone="warn">
                <strong>Canonical $WIF contract not confirmed in this build.</strong>{' '}
                Invoices can be verified, but the pay action is disabled so nobody sends
                to an unconfirmed token. Set <span className="mono">VITE_WIF_TOKEN_ADDRESS</span>{' '}
                once the organizer confirms it.
              </Notice>
            ) : null}

            {warnings.length > 0 && !alreadyPaid ? (
              <Notice tone="warn">
                {warnings.map((w) => (
                  <div key={w.id} style={{ marginBottom: 6 }}>
                    <strong>{w.label}:</strong> {w.detail}
                  </div>
                ))}
                <label
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    marginTop: 8,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    I verified this payee through a contact route I already trust.
                  </span>
                </label>
              </Notice>
            ) : null}

            <div className="actions">
              {wallet.address === null ? (
                <button
                  className="btn btn--primary"
                  onClick={() => void wallet.connect()}
                  disabled={wallet.connecting}
                >
                  {wallet.connecting ? 'Connecting…' : 'Connect wallet to pay'}
                  <span className="btn__sub">Read-only checks above need no wallet</span>
                </button>
              ) : wrongNetwork ? (
                <button className="btn btn--primary" onClick={() => void wallet.switchNetwork()}>
                  Switch to Robinhood Chain
                  <span className="btn__sub">Wallet is on chain {wallet.chainId}</span>
                </button>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={() => void handlePay()}
                  disabled={!canPay}
                >
                  {phase === 'signing'
                    ? 'Confirm in your wallet…'
                    : phase === 'pending'
                      ? 'Waiting for receipt…'
                      : `Pay ${formatAmount(invoice.payload.amount)} WIF`}
                  <span className="btn__sub">
                    {gate.allowed
                      ? 'Direct transfer · no approval · no custody'
                      : gate.reason}
                  </span>
                </button>
              )}

              <a className="btn btn--ghost" href="#/create">
                Create your own invoice
              </a>
            </div>

            {wallet.error ? <Notice tone="fail">{wallet.error}</Notice> : null}
          </div>
        </div>
      </div>

      <aside>
        <div className="panel">
          <div className="panel__head">
            <span>Route check</span>
            <span className="right">These checks are separate</span>
          </div>
          <div className="panel__body" style={{ paddingTop: 8, paddingBottom: 8 }}>
            <CheckList checks={checks} />
            <Notice tone="info">
              A matching signature proves control of a signing key over these fields. It
              does not prove legal identity, that the invoice is legitimate, or that a
              payment can be recovered.
            </Notice>
          </div>
        </div>
      </aside>
    </div>
  )
}
