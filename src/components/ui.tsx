import { useCallback, useState, type ReactNode } from 'react'
import type { CheckStatus } from '../types'

export function Badge({ status, children }: { status: CheckStatus; children: ReactNode }) {
  return <span className={`badge badge--${status}`}>{children}</span>
}

export function Notice({
  tone,
  children,
}: {
  tone: 'warn' | 'fail' | 'info'
  children: ReactNode
}) {
  return (
    <div className={`notice notice--${tone}`}>
      <span className="notice__bar" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

/**
 * The async clipboard API is unavailable outside a secure context, which is
 * exactly what a demo served over plain http looks like. Fall back rather than
 * failing silently: a copy button that does nothing reads as broken.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.top = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = useCallback(async () => {
    const ok = await writeClipboard(value)
    setState(ok ? 'copied' : 'failed')
    setTimeout(() => setState('idle'), 1600)
  }, [value])

  return (
    <button type="button" className="copy-btn" onClick={copy} aria-live="polite">
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy' : label}
    </button>
  )
}

export function Stamp({
  state,
  variant = 'default',
  serial,
}: {
  state: string
  variant?: 'default' | 'locked' | 'paid'
  serial?: string
}) {
  return (
    <div className={`stamp${variant === 'default' ? '' : ` stamp--${variant}`}`}>
      <span className="stamp__state">{state}</span>
      {serial ? <span>{serial}</span> : null}
    </div>
  )
}

export function Brand() {
  return (
    <a className="brand" href="#/" aria-label="PayeeStamp home">
      <svg className="brand__mark" viewBox="0 0 22 22" aria-hidden="true">
        {/* An invoice corner intersected by a key notch — no third-party marks. */}
        <path d="M2 2h18v12l-6 6H2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14 20v-6h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="6" y="7" width="7" height="1.8" fill="#C6F550" />
        <rect x="6" y="11" width="4.5" height="1.8" fill="#C6F550" opacity="0.55" />
      </svg>
      <span className="brand__word">
        Payee<em>Stamp</em>
      </span>
    </a>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}
