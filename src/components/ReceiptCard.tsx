import { explorerTx } from '../lib/chain'
import { CopyButton } from './ui'

export function ReceiptCard({ hash }: { hash: string }) {
  return (
    <div className="receipt fade-in">
      <div className="receipt__head">
        <span aria-hidden="true">✓</span> Receipt verified
      </div>
      <p className="receipt__hash">{hash}</p>
      <p className="check__detail" style={{ marginTop: 8 }}>
        A Transfer event from the pinned contract, from your address to the payee,
        for the exact signed amount, in a transaction that succeeded.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <a
          className="receipt__link"
          href={explorerTx(hash)}
          target="_blank"
          rel="noreferrer noopener"
        >
          View on explorer ↗
        </a>
        <CopyButton value={hash} label="Copy hash" />
      </div>
    </div>
  )
}
