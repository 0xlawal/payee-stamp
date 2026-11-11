import { useEffect, useState } from 'react'
import { Brand } from './components/ui'
import { StartScreen } from './screens/StartScreen'
import { CreateScreen } from './screens/CreateScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { DEMO_INVOICE } from './demo/demoInvoice'
import { encodeInvoice } from './lib/eip712'

type Route =
  | { name: 'start' }
  | { name: 'create' }
  | { name: 'review'; encoded: string }

function parseRoute(): Route {
  const hash = window.location.hash
  if (hash.startsWith('#i=')) {
    const encoded = hash.slice(3)
    if (encoded === 'demo' && DEMO_INVOICE) {
      return { name: 'review', encoded: encodeInvoice(DEMO_INVOICE) }
    }
    return { name: 'review', encoded }
  }
  if (hash.startsWith('#/create')) return { name: 'create' }
  return { name: 'start' }
}

const HERO = {
  start: {
    eyebrow: 'Invoice review / payer view',
    title: ['Check the payee.', 'Then pay.'],
    sub: 'One signed invoice. One clear destination. A real wallet transfer only after the payer reviews the details.',
  },
  create: {
    eyebrow: 'Payee / create and sign',
    title: ['Sign the terms.', 'Not the address bar.'],
    sub: 'Your wallet signs the exact amount, token, chain and destination. The payer can verify all of it before anything moves.',
  },
  review: {
    eyebrow: 'Invoice review / payer view',
    title: ['Check the payee.', 'Then pay.'],
    sub: 'One signed invoice. One clear destination. A real wallet transfer only after the payer reviews the details.',
  },
} as const

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const hero = HERO[route.name]

  return (
    <div className="shell">
      <header className="masthead">
        <Brand />
        <div className="masthead__meta">
          <span className="masthead__dot" aria-hidden="true" />
          <span>WIF hackathon · Nov 2026</span>
          <span>Robinhood Chain · 4663</span>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="hero__eyebrow">{hero.eyebrow}</p>
          <h1 className="hero__title">
            <span>{hero.title[0]}</span>
            <span className="dim">{hero.title[1]}</span>
          </h1>
          <p className="hero__sub">{hero.sub}</p>
        </div>
        <div className="hero__side">
          <div>Consumer + payments</div>
          <div>No custody</div>
          <div>No approval</div>
        </div>
      </section>

      {route.name === 'start' ? <StartScreen /> : null}
      {route.name === 'create' ? <CreateScreen /> : null}
      {route.name === 'review' ? <ReviewScreen encoded={route.encoded} /> : null}

      <footer className="footnote">
        <span>
          PayeeStamp · design artifact for the World Is Flat hackathon
          <br />
          No Robinhood affiliation or endorsement. Working name only.
        </span>
        <span>
          Signature ≠ identity · Transfer ≠ recoverable
          <br />
          Local data lives in this browser only
        </span>
      </footer>
    </div>
  )
}
