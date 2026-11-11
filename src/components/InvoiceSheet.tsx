import type { InvoicePayload } from '../types'
import { formatAmount, formatTimestamp } from '../lib/format'
import { CopyButton } from './ui'

export function InvoiceSheet({ payload }: { payload: InvoicePayload }) {
  return (
    <article className="sheet">
      <div className="sheet__top">
        <div>
          <p className="sheet__label">Outgoing payment / WIF</p>
          <h2 className="sheet__title">{payload.reference || 'Invoice'}</h2>
          <p className="sheet__ref">
            Issued {formatTimestamp(payload.issuedAt)} · ID{' '}
            {payload.invoiceId.slice(2, 10)}
          </p>
        </div>
        <div className="sheet__amount">
          <p className="sheet__label">Amount</p>
          <div className="sheet__amount-value">
            {formatAmount(payload.amount)}
            <span className="sheet__amount-unit">WIF</span>
          </div>
        </div>
      </div>

      <div className="sheet__grid">
        <div>
          <p className="sheet__addr-label">Payee / signer</p>
          <p className="sheet__payee-name">
            {payload.reference ? 'Signed payee' : 'Signed payee'}
          </p>
          <p className="sheet__note">
            The wallet that signed these fields. Not a legal identity proof.
          </p>
        </div>
        <div>
          <p className="sheet__addr-label">Pay to</p>
          <p className="sheet__addr">{payload.payee}</p>
          <p className="sheet__addr-label" style={{ marginTop: 12 }}>
            Network
          </p>
          <p className="sheet__addr">Robinhood Chain · {payload.chainId}</p>
        </div>
      </div>

      <div className="addr-strip">
        <span className="addr-strip__value">{payload.payee}</span>
        <CopyButton value={payload.payee} label="Copy address" />
      </div>
    </article>
  )
}
