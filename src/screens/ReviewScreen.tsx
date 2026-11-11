import { useEffect, useMemo, useState } from 'react'
import { decodeInvoice, recoverSigner, sameAddress } from '../lib/eip712'
import { buildChecks, outstandingWarnings, paymentGate } from '../lib/verify'
import {
  CHAIN_ID,
  PAYMENTS_ENABLED,
  SAMPLE_PAYEE,
  WIF_TOKEN_ADDRESS,
  explorerTx,
} from '../lib/chain'
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
    signer,
    savedRecord,
    recovering,
  })

  const gate = paymentGate(checks, PAYMENTS_ENABLED)
  const warnings = outstandingWarnings(checks)
  const priorPayment = getPayment(invoice.payload.invoiceId)
  const alreadyPaid = priorPayment?.state === 'paid'
  /**
   * A transfer submitted from this browser that has not settled yet. Reloading
   * the page must not release the pay button, or the same invoice can be paid
   * twice by accident.
   */
  const pendingPrior =
    priorPayment?.state === 'pending' && priorPayment.txHash ? priorPayment : undefined

  /**
   * The sample invoice pays an address whose private key is in this repository.
   * It exists to exercise verification, never to receive funds.
   */
  const samplePayee = sameAddress(invoice.payload.payee, SAMPLE_PAYEE)

  const wrongNetwork = wallet.address !== null && wallet.chainId !== CHAIN_ID
  const canPay =
    gate.allowed &&
    wallet.address !== null &&
    !wrongNetwork &&
    !alreadyPaid &&
    !pendingPrior &&
    !samplePayee &&
    (warnings.length === 0 || ack) &&
    phase !== 'pending' &&
    phase !== 'signing'

  async function handlePay() {
    if (!invoice || !wallet.walletClient || !wallet.address || !WIF_TOKEN_ADDRESS) return

    const id = invoice.payload.invoiceId
    const payee = invoice.payload.payee
    const amount = invoice.payload.amount

    setError(null)
    setPhase('signing')
    try {
      const hash = await wallet.walletClient.writeContract({
        address: WIF_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [payee, BigInt(amount)],
        account: wallet.address,
        chain: wallet.walletClient.chain,
      })

      setTxHash(hash)
      setPhase('pending')
      setPayment(id, { state: 'pending', payee, amount, txHash: hash })

      const receipt = await waitForReceipt(hash)
      if (receipt.status !== 'success') {
        setPayment(id, { state: 'failed', payee, amount, txHash: hash })
        setError('The transfer reverted on chain. Nothing was sent.')
        setPhase('failed')
        return
      }

      // Verify against the contract we actually sent to, not the invoice's own
      // claim. Check 04 already requires the two to match, so this is a second
      // lock on the same door.
      const check = verifyReceipt(receipt, {
        token: WIF_TOKEN_ADDRESS,
        from: wallet.address,
        to: payee,
        amount: BigInt(amount),
      })

      if (!check.ok) {
        setError(check.reason ?? 'Receipt did not match this invoice.')
        setPhase('failed')
        setPayment(id, { state: 'failed', payee, amount, txHash: hash })
        return
      }

      savePayee(payee)
      setPayment(id, { state: 'paid', payee, amount, txHash: hash })
      setPhase('paid')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'The wallet did not complete the transfer.'
      setError(message)
      setPhase('failed')
    }
  }

  /**
   * Re-check a transfer this browser already submitted, for example after a
   * reload. A successful receipt that does not match this invoice is left
   * pending rather than failed, so it can never unlock a second payment.
   */
  async function recheckPending(hash: Hex) {
    if (!invoice || !WIF_TOKEN_ADDRESS) return

    const id = invoice.payload.invoiceId
    const payee = invoice.payload.payee
    const amount = invoice.payload.amount

    setError(null)
    setTxHash(hash)
    setPhase('pending')
    try {
      const receipt = await waitForReceipt(hash)

      if (receipt.status !== 'success') {
        setPayment(id, { state: 'failed', payee, amount, txHash: hash })
        setError('That transfer reverted on chain. Nothing was sent.')
        setPhase('failed')
        return
      }

      // The payer may have changed wallet since the reload, so only pin what
      // this transaction hash must contain: token, recipient, exact amount.
      const check = verifyReceipt(receipt, {
        token: WIF_TOKEN_ADDRESS,
        from: null,
        to: payee,
        amount: BigInt(amount),
      })

      if (!check.ok) {
        setError(
          `${check.reason ?? 'Receipt did not match this invoice.'} This transfer stays marked pending — check it on the explorer before paying again.`,
        )
        setPhase('idle')
        return
      }

      savePayee(payee)
      setPayment(id, { state: 'paid', payee, amount, txHash: hash })
      setPhase('paid')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that transaction.')
      setPhase('idle')
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

            {pendingPrior && phase !== 'paid' ? (
              <Notice tone="warn">
                <strong>A transfer for this invoice is already pending.</strong> It was
                submitted from this browser and has not confirmed yet. Paying again could
                send the money twice.
                <div style={{ marginTop: 6 }}>
                  <a
                    className="mono"
                    href={explorerTx(pendingPrior.txHash!)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {pendingPrior.txHash!.slice(0, 10)}… on explorer
                  </a>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn--ghost"
                    onClick={() => void recheckPending(pendingPrior.txHash!)}
                    disabled={phase === 'pending'}
                  >
                    Re-check that transfer
                  </button>
                </div>
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

            {samplePayee && PAYMENTS_ENABLED ? (
              <Notice tone="warn">
                <strong>This sample pays a publicly known address.</strong> Its private key
                is committed in this repository, so anything sent there can be taken by
                anyone who has read it. Payment to the sample is disabled on purpose. Create
                your own invoice, paying an address you control, to demo a real transfer.
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
