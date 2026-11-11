import type {
  Hex,
  PayeeRecord,
  PaymentRecord,
  PaymentState,
  ReferenceRecord,
} from '../types'

const KEY = 'payeestamp.v1'
const VERSION = 1

interface StoreShape {
  version: number
  payees: Record<string, PayeeRecord>
  payments: Record<string, PaymentRecord>
  references: Record<string, ReferenceRecord>
}

function emptyStore(): StoreShape {
  return { version: VERSION, payees: {}, payments: {}, references: {} }
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
      // Added after v1 shipped; absent in older payloads and in older backups.
      references: parsed.references ?? {},
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

export function getReferenceRecord(referenceHash: Hex): ReferenceRecord | undefined {
  return read().references[key(referenceHash)]
}

/**
 * Remember which address invoiced a reference. Written only after a transfer
 * settles, so a link that merely arrives cannot poison the record.
 */
export function saveReference(referenceHash: Hex, payee: Hex): ReferenceRecord {
  const store = read()
  const k = key(referenceHash)
  const now = Math.floor(Date.now() / 1000)
  const existing = store.references[k]

  const record: ReferenceRecord = existing
    ? { ...existing, payee, lastSeen: now }
    : { referenceHash, payee, firstSeen: now, lastSeen: now }

  store.references[k] = record
  write(store)
  return record
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

  // Count the transition into "paid", not every write of a paid record.
  if (record.state === 'paid' && existing?.state !== 'paid' && record.payee !== '0x') {
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
      references: parsed.references ?? {},
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
