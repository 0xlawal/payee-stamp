import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { Badge, Brand, Notice, Stamp } from '../src/components/ui'
import { InvoiceSheet } from '../src/components/InvoiceSheet'
import type { CheckResult } from '../src/types'
import {
  PAYLOAD,
  RECOVERING_CHECK,
  SIGNATURE_CHECK,
  SIGNED_FIELDS,
  TRAILING_CHECKS,
} from './data'
import { ENTER, PUNCH, enter, fade, rise } from './lib'

const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 14,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--lime)',
  margin: 0,
}

const SERIAL = `INV ${PAYLOAD.invoiceId.slice(2, 10).toUpperCase()}`

/* ------------------------------- primitives ------------------------------- */

/** Positions a block at its design width, then scales it up for 1080p. */
const Scaled: React.FC<{
  width: number
  scale: number
  left: number
  top: number
  children: React.ReactNode
}> = ({ width, scale, left, top, children }) => (
  <div
    style={{
      position: 'absolute',
      width,
      left,
      top,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }}
  >
    {children}
  </div>
)

const Panel: React.FC<{
  title: string
  right?: string
  children: React.ReactNode
}> = ({ title, right, children }) => (
  <div className="panel">
    <div className="panel__head">
      <span>{title}</span>
      <span className="right">{right}</span>
    </div>
    <div className="panel__body">{children}</div>
  </div>
)

const CheckRow: React.FC<{ check: CheckResult; at: number; punch?: number }> = ({
  check,
  at,
  punch = 1,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = enter(frame, fps, at, ENTER)

  return (
    <li
      className="check"
      style={{ opacity: p, transform: `translateX(${(1 - p) * 26}px)` }}
    >
      <span className="check__index">{check.index}</span>
      <div>
        <p className="check__label">{check.label}</p>
        <p className="check__detail">{check.detail}</p>
      </div>
      <span
        style={{
          display: 'inline-block',
          transform: `scale(${punch})`,
          transformOrigin: 'center right',
        }}
      >
        <Badge status={check.status}>{check.badge}</Badge>
      </span>
    </li>
  )
}

/* --------------------------------- 1. intro -------------------------------- */

export const Intro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const brandIn = enter(frame, fps, 6)
  const line1 = enter(frame, fps, 22)
  const line2 = enter(frame, fps, 36)
  const rule = enter(frame, fps, 50)
  const subIn = fade(frame, 62, 88)
  const metaIn = fade(frame, 82, 106)

  return (
    <AbsoluteFill style={{ padding: '0 160px', justifyContent: 'center' }}>
      <div style={rise(brandIn, 18)}>
        <Brand />
      </div>

      <h1
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 130,
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          fontWeight: 600,
          margin: '54px 0 0',
          color: 'var(--ink)',
        }}
      >
        <span style={{ display: 'block', ...rise(line1, 44) }}>Check the payee.</span>
        <span style={{ display: 'block', color: 'var(--ink-faint)', ...rise(line2, 44) }}>
          Then pay.
        </span>
      </h1>

      <div
        style={{
          height: 2,
          marginTop: 46,
          width: rule * 240,
          background: 'var(--lime)',
          opacity: 0.85,
        }}
      />

      <p
        style={{
          ...rise(subIn, 22),
          marginTop: 34,
          maxWidth: 880,
          fontFamily: 'var(--sans)',
          fontSize: 29,
          lineHeight: 1.5,
          color: 'var(--ink-muted)',
        }}
      >
        One signed invoice. One clear destination. A real wallet transfer only after
        the payer reviews the details.
      </p>

      <div
        style={{
          ...rise(metaIn, 14),
          marginTop: 44,
          display: 'flex',
          gap: 30,
          fontFamily: 'var(--mono)',
          fontSize: 14,
          letterSpacing: '0.17em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        <span>WIF hackathon · Nov 2026</span>
        <span>Robinhood Chain · 4663</span>
        <span>No custody</span>
      </div>
    </AbsoluteFill>
  )
}

/* -------------------------------- 2. invoice ------------------------------- */

const FieldRow: React.FC<{ label: string; value: string; at: number }> = ({
  label,
  value,
  at,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = enter(frame, fps, at, ENTER)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 24,
        padding: '17px 0',
        borderBottom: '1px solid var(--line)',
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 13,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 20,
          color: 'var(--ink)',
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export const InvoiceBeat: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const cardIn = enter(frame, fps, 6)
  const headIn = fade(frame, 0, 20)
  const count = enter(frame, fps, 24, { damping: 200, mass: 1.1, stiffness: 70 })
  const scan = interpolate(frame, [66, 128], [-0.1, 1.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const whole = Math.round(count * 8400)
  const payload = {
    ...PAYLOAD,
    amount: (BigInt(whole) * 10n ** 18n).toString(),
  }

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, top: 104, ...rise(headIn, 20) }}>
        <p style={EYEBROW}>The invoice</p>
        <h2
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 46,
            letterSpacing: '-0.03em',
            fontWeight: 600,
            color: 'var(--ink)',
            margin: '14px 0 0',
          }}
        >
          Four facts, signed together.
        </h2>
      </div>

      <Scaled width={820} scale={1.22} left={150} top={286}>
        <div
          style={{
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * 70}px) scale(${0.96 + cardIn * 0.04})`,
          }}
        >
          <div style={{ position: 'relative' }}>
            <InvoiceSheet payload={payload} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${scan * 100}%`,
                  height: 150,
                  background:
                    'linear-gradient(to bottom, rgba(198,245,80,0) 0%, rgba(198,245,80,0.30) 50%, rgba(198,245,80,0) 100%)',
                }}
              />
            </div>
          </div>
        </div>
      </Scaled>

      <div style={{ position: 'absolute', left: 1230, top: 320, width: 560 }}>
        {SIGNED_FIELDS.map((field, i) => (
          <FieldRow
            key={field.label}
            label={field.label}
            value={field.value}
            at={78 + i * 26}
          />
        ))}
        <p
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 19,
            lineHeight: 1.55,
            color: 'var(--ink-muted)',
            marginTop: 26,
            opacity: fade(frame, 190, 214),
          }}
        >
          Change any one of them and the signature no longer recovers to the payee.
        </p>
      </div>
    </AbsoluteFill>
  )
}

/* -------------------------------- 3. checks -------------------------------- */

const ROW_AT = [26, 68, 110, 152, 194, 236, 278]
const FLIP = 62

export const ChecksBeat: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headIn = fade(frame, 0, 22)
  const panelIn = enter(frame, fps, 8)
  const recovered = frame >= FLIP
  const flip = enter(frame, fps, FLIP, PUNCH)
  const punch = frame >= FLIP ? 1 + 0.24 * (1 - flip) : 1

  const checks: CheckResult[] = [
    recovered ? SIGNATURE_CHECK : RECOVERING_CHECK,
    ...TRAILING_CHECKS,
  ]

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 130, top: 300, width: 470, ...rise(headIn, 24) }}>
        <p style={EYEBROW}>Route check</p>
        <h2
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 52,
            lineHeight: 1.04,
            letterSpacing: '-0.035em',
            fontWeight: 600,
            color: 'var(--ink)',
            margin: '16px 0 0',
          }}
        >
          Seven checks.
          <br />
          <span style={{ color: 'var(--ink-faint)' }}>Never folded together.</span>
        </h2>
        <p
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 19,
            lineHeight: 1.6,
            color: 'var(--ink-muted)',
            marginTop: 26,
          }}
        >
          A matching signature is never shown on the same line as a known payee. One
          proves control of a key. The other proves you have seen this address before.
        </p>
      </div>

      <Scaled width={620} scale={1.5} left={672} top={104}>
        <div style={{ opacity: panelIn, transform: `translateY(${(1 - panelIn) * 40}px)` }}>
          <Panel
            title="PayeeStamp / Review"
            right={recovered ? 'Read only until checks pass' : 'Verifying…'}
          >
            <ol className="checks">
              {checks.map((check, i) => (
                <CheckRow
                  key={check.id}
                  check={check}
                  at={ROW_AT[i]}
                  punch={i === 0 ? punch : 1}
                />
              ))}
            </ol>
          </Panel>
        </div>
      </Scaled>
    </AbsoluteFill>
  )
}

/* ------------------------------ 4. warnings -------------------------------- */

const TICK_AT = 76

export const AckBeat: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headIn = fade(frame, 0, 20)
  const noticeIn = enter(frame, fps, 10)
  const ticked = frame >= TICK_AT
  const tickScale = enter(frame, fps, TICK_AT, PUNCH)
  const footIn = fade(frame, 88, 112)

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ ...EYEBROW, color: 'var(--amber)', opacity: headIn }}>
        Warnings, not silent passes
      </p>

      <div
        style={{
          width: 820,
          marginTop: 44,
          opacity: noticeIn,
          transform: `scale(1.85) translateY(${(1 - noticeIn) * 20}px)`,
          transformOrigin: 'center top',
        }}
      >
        <Notice tone="warn">
          <div style={{ marginBottom: 6 }}>
            <strong>Saved payee record:</strong> No record for this address in this
            browser.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Token contract:</strong> This build has no organizer-confirmed $WIF
            contract, so payment stays disabled.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span
              style={{
                marginTop: 2,
                width: 13,
                height: 13,
                border: '1px solid var(--amber)',
                borderRadius: 2,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                transform: `scale(${ticked ? 1 + 0.22 * (1 - tickScale) : 1})`,
                background: ticked ? 'rgba(240,182,91,0.92)' : 'transparent',
              }}
            >
              {ticked ? (
                <span
                  style={{
                    fontSize: 10,
                    lineHeight: 1,
                    color: 'var(--graphite)',
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              ) : null}
            </span>
            <span>I verified this payee through a contact route I already trust.</span>
          </div>
        </Notice>
      </div>

      <p
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 26,
          color: 'var(--ink-muted)',
          marginTop: 190,
          opacity: footIn,
        }}
      >
        Nothing unlocks until the payer acknowledges them.
      </p>
    </AbsoluteFill>
  )
}

/* --------------------------------- 5. gate --------------------------------- */

const PILLS = ['No custody', 'No approval', 'Direct transfer']

export const GateBeat: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headIn = fade(frame, 0, 22)
  const stampIn = enter(frame, fps, 14, PUNCH)

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ ...EYEBROW, color: 'var(--ink-faint)', opacity: headIn }}>
        Every check read separately
      </p>

      <div
        style={{
          marginTop: 70,
          width: 470,
          opacity: Math.min(1, stampIn * 1.6),
          transform: `scale(${(0.9 + stampIn * 0.1) * 2.2})`,
          transformOrigin: 'center center',
        }}
      >
        <Stamp state="Checks passed" variant="default" serial={SERIAL} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 110,
          opacity: fade(frame, 54, 76),
        }}
      >
        {PILLS.map((pill, i) => (
          <span
            key={pill}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 15,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              border: '1px solid var(--line-strong)',
              borderRadius: 2,
              padding: '9px 16px',
              opacity: fade(frame, 54 + i * 10, 74 + i * 10),
            }}
          >
            {pill}
          </span>
        ))}
      </div>

      <p
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 24,
          color: 'var(--ink-muted)',
          marginTop: 44,
          opacity: fade(frame, 96, 120),
        }}
      >
        Read-only until every check passes.
      </p>
    </AbsoluteFill>
  )
}

/* --------------------------------- 6. pay ---------------------------------- */

const CLICK = 74
const SIGNING = 84
const PENDING = 118
const PAID = 152

export const PayBeat: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const btnIn = enter(frame, fps, 8)
  const ripple = enter(frame, fps, CLICK, { damping: 200, mass: 0.4, stiffness: 60 })
  const rippleOpacity = interpolate(frame, [CLICK, CLICK + 30], [0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const paidIn = enter(frame, fps, PAID, PUNCH)

  const label =
    frame >= PAID
      ? 'Paid and receipt verified'
      : frame >= PENDING
        ? 'Waiting for receipt…'
        : frame >= SIGNING
          ? 'Confirm in your wallet…'
          : 'Pay 8,400 WIF'

  const sub =
    frame >= PAID
      ? 'Transfer event matched the signed fields'
      : frame >= PENDING
        ? 'Not paid until the receipt verifies'
        : 'Direct transfer · no approval · no custody'

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ ...EYEBROW, color: 'var(--ink-faint)', opacity: fade(frame, 0, 20) }}>
        The pay action
      </p>

      <div
        style={{
          marginTop: 60,
          position: 'relative',
          opacity: btnIn,
          transform: `translateY(${(1 - btnIn) * 30}px)`,
        }}
      >
        {frame >= CLICK && frame < PAID ? (
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 110,
              height: 110,
              marginLeft: -55,
              marginTop: -55,
              borderRadius: '50%',
              border: '2px solid var(--lime)',
              transform: `scale(${0.5 + ripple * 1.3})`,
              opacity: rippleOpacity,
              pointerEvents: 'none',
            }}
          />
        ) : null}

        <button
          className="btn btn--primary"
          style={{
            transform: 'scale(1.9)',
            minWidth: 340,
            ...(frame >= PAID
              ? { borderColor: 'rgba(198,245,80,0.55)', color: 'var(--lime)' }
              : {}),
          }}
        >
          {label}
          <span className="btn__sub">{sub}</span>
        </button>
      </div>

      <div
        style={{
          marginTop: 130,
          width: 720,
          opacity: paidIn,
          transform: `translateY(${(1 - paidIn) * 26}px) scale(${0.96 + paidIn * 0.04})`,
        }}
      >
        {frame >= PAID ? (
          <div className="receipt">
            <div className="receipt__head">
              <span aria-hidden="true">✓</span> Receipt verified
            </div>
            <p className="receipt__hash">
              0x9f2c4d1e7a8b3c5d6e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d
            </p>
            <p className="check__detail" style={{ marginTop: 8 }}>
              A Transfer event from the pinned contract, from your address to the payee,
              for the exact signed amount, in a transaction that succeeded.
            </p>
          </div>
        ) : null}
      </div>

      <p
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 18,
          color: 'var(--ink-faint)',
          marginTop: 26,
          opacity: fade(frame, 26, 50),
        }}
      >
        Payment path — unlocked once the canonical $WIF contract is confirmed.
      </p>
    </AbsoluteFill>
  )
}

/* -------------------------------- 7. outro --------------------------------- */

export const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const a = enter(frame, fps, 4)
  const b = enter(frame, fps, 16)
  const rule = enter(frame, fps, 30)
  const c = fade(frame, 40, 62)
  const d = fade(frame, 56, 78)
  const out = interpolate(frame, [100, 128], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', padding: '0 160px', opacity: out }}
    >
      <h2
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 86,
          lineHeight: 1.06,
          letterSpacing: '-0.038em',
          fontWeight: 600,
          color: 'var(--ink)',
          margin: 0,
        }}
      >
        <span style={{ display: 'block', ...rise(a, 30) }}>Signature ≠ identity.</span>
        <span style={{ display: 'block', color: 'var(--ink-faint)', ...rise(b, 30) }}>
          Transfer ≠ recoverable.
        </span>
      </h2>

      <div
        style={{
          height: 2,
          marginTop: 44,
          width: rule * 240,
          background: 'var(--lime)',
          opacity: 0.8,
        }}
      />

      <p
        style={{
          ...rise(c, 18),
          marginTop: 34,
          fontFamily: 'var(--sans)',
          fontSize: 28,
          color: 'var(--ink-muted)',
        }}
      >
        PayeeStamp — a design artifact for the World Is Flat hackathon.
      </p>

      <p
        style={{
          ...rise(d, 14),
          marginTop: 18,
          fontFamily: 'var(--mono)',
          fontSize: 19,
          letterSpacing: '0.08em',
          color: 'var(--ink-muted)',
        }}
      >
        github.com/0xlawal/payee-stamp
      </p>
    </AbsoluteFill>
  )
}
