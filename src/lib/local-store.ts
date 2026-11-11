import type { Hex, PayeeRecord, PaymentRecord, PaymentState } from '../types'

const KEY = 'payeestamp.v1'
const VERSION = 1

interface StoreShape {
  version: number
  payees: Record<string, PayeeRecord>
  payments: Record<string, PaymentRecord>
}

function emptyStore(): StoreShape {
  return { version: VERSION, payees: {}, payments: {} }
}

function read(): StoreShape {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as StoreShape
    if (!parsed || parsed.version !== VERSION) return emptyStore()
    return {
      version: VERSION,
      payees: parsed.payees ?? {},
      payments: parsed.payments ?? {},
    }
  } catch {
    return emptyStore()
  }
}

function write(store: StoreShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Storage can be unavailable (private mode, quota). The app still works,
    // it just cannot remember payees between visits.
  }
}

function key(address: string): string {
  return address.toLowerCase()
}

export function getPayeeRecord(address: Hex): PayeeRecord | undefined {
  return read().payees[key(address)]
}

export function listPayeeRecords(): PayeeRecord[] {
  return Object.values(read().payees).sort((a, b) => b.lastSeen - a.lastSeen)
}

export function savePayee(address: Hex, label = 'Saved payee'): PayeeRecord {
  const store = read()
  const k = key(address)
  const now = Math.floor(Date.now() / 1000)
  const existing = store.payees[k]

  const record: PayeeRecord = existing
    ? { ...existing, lastSeen: now, label: existing.label || label }
    : { address, label, firstSeen: now, lastSeen: now, paymentCount: 0 }

  store.payees[k] = record
  write(store)
  return record
}

export function removePayee(address: Hex): void {
  const store = read()
  delete store.payees[key(address)]
  write(store)
}

export function getPayment(invoiceId: Hex): PaymentRecord | undefined {
  return read().payments[key(invoiceId)]
}

export function setPayment(
  invoiceId: Hex,
  patch: Partial<Omit<PaymentRecord, 'invoiceId'>> & { state: PaymentState },
): PaymentRecord {
  const store = read()
  const k = key(invoiceId)
  const existing = store.payments[k]

  const record: PaymentRecord = {
    invoiceId,
    payee: patch.payee ?? existing?.payee ?? '0x',
    amount: patch.amount ?? existing?.amount ?? '0',
    txHash: patch.txHash ?? existing?.txHash,
    state: patch.state,
    updatedAt: Math.floor(Date.now() / 1000),
  }

  store.payments[k] = record

  if (record.state === 'paid' && record.payee !== '0x') {
    const pk = key(record.payee)
    const payeeRecord = store.payees[pk]
    if (payeeRecord) payeeRecord.paymentCount += 1
  }

  write(store)
  return record
}

export function listPayments(): PaymentRecord[] {
  return Object.values(read().payments).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function exportBackup(): string {
  return JSON.stringify(read(), null, 2)
}

export function importBackup(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as StoreShape
    if (!parsed || parsed.version !== VERSION) return false
    write({
      version: VERSION,
      payees: parsed.payees ?? {},
      payments: parsed.payments ?? {},
    })
    return true
  } catch {
    return false
  }
}

export function clearAll(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
