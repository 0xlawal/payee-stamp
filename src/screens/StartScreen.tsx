import { Notice } from '../components/ui'
import { PAYMENTS_ENABLED } from '../lib/chain'

export function StartScreen() {
  return (
    <div className="workbench">
      <div className="panel">
        <div className="panel__head">
          <span>Start</span>
          <span className="right">No wallet needed to check</span>
        </div>
        <div className="panel__body">
          <p className="check__detail" style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 0 }}>
            A payer receives an invoice link. PayeeStamp shows the exact amount and
            destination that the payee's wallet signed, compares it against the address
            the payer already saved, and only then offers a direct wallet transfer.
          </p>

          <div className="actions">
            <a className="btn btn--primary" href="#/create">
              Create a signed invoice
              <span className="btn__sub">Payee · sign with your wallet, no gas</span>
            </a>
            <a className="btn btn--ghost" href="#i=demo">
              Open the sample invoice
              <span className="btn__sub">Payer · read-only, no wallet needed</span>
            </a>
          </div>

          {!PAYMENTS_ENABLED ? (
            <Notice tone="warn">
              <strong>Payment is disabled in this build.</strong> The organizer has not
              confirmed a canonical $WIF contract, so every check runs but the pay action
              stays locked. This is deliberate, not a bug.
            </Notice>
          ) : null}

          <Notice tone="info">
            PayeeStamp never takes custody, never asks for an approval, and cannot reverse
            a transfer. A valid signature proves key control — not legal identity.
          </Notice>
        </div>
      </div>

      <aside>
        <div className="panel">
          <div className="panel__head">
            <span>The four steps</span>
          </div>
          <div className="panel__body" style={{ paddingTop: 6 }}>
            <ol className="checks">
              {[
                ['01', 'Payee signs', 'Exact fields, no gas'],
                ['02', 'Payer checks', 'Signature + saved route'],
                ['03', 'Wallet sends', 'Direct transfer, no approval'],
                ['04', 'Chain receipt', 'Transfer log verified'],
              ].map(([index, label, detail]) => (
                <li className="check" key={index} style={{ gridTemplateColumns: '26px 1fr' }}>
                  <span className="check__index">{index}</span>
                  <div>
                    <p className="check__label">{label}</p>
                    <p className="check__detail">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </div>
  )
}
