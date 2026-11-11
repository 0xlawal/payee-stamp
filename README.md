# PayeeStamp

**Check the payee. Then pay.**

A payer-side check for recurring `$WIF` invoices on Robinhood Chain. The payee signs the
exact amount, token, chain and destination with their wallet — offchain, no gas, no
approval. The payer sees those fields, compares the destination against the address they
already saved, and only then sends a direct ERC-20 `transfer` from their own wallet.

Built for the **World Is Flat** hackathon, Consumer and payments category.

> Working name. Not affiliated with or endorsed by Robinhood. The network is referred to
> as "Robinhood Chain" per its brand guidelines.

---

## What it does not do

These are deliberate boundaries, not gaps to be filled later:

- **No custody.** PayeeStamp never holds funds and never becomes a counterparty.
- **No approvals.** The only contract call is `transfer(to, amount)`. There is no
  `approve`, no `transferFrom`, no `permit`.
- **No identity claims.** A valid signature proves control of a signing key over the
  signed fields. It does not prove the signer's legal name, that the invoice describes
  real work, or that a payment can be recovered.
- **No fraud prevention.** A confirmed transfer cannot be reversed by this app.
- **No global replay protection.** The invoice ID is a random identifier, not an onchain
  nonce. An ERC-20 `Transfer` event carries no invoice ID, so the app cannot prove from
  the chain alone that a transfer settled only one specific invoice.
- **No backend.** All state is local to the payer's browser.

---

## Why `$WIF` is load-bearing here

The settlement is a real `$WIF` transfer for a real invoice, not a token used as a badge
or a reward. The return loop is the recurring contributor: the payee issues invoices each
month, and the payer's saved payee record is what makes the next check fast. That is a
testable hypothesis about why a payer comes back — not a claim that a flywheel exists.

---

## Quick start

```bash
npm install
npm run dev
```

Then open the printed local URL. The app runs **read-only** until a token contract is
pinned (see below). You can create and verify invoices with no wallet and no contract.

```bash
npm test        # unit tests for signing payloads, checks, and amount formatting
npm run build   # type-check and produce a static bundle in dist/
npm run preview # serve the production build
```

---

## Enabling payment

Payment stays disabled unless `VITE_WIF_TOKEN_ADDRESS` is set to a contract the organizer
has confirmed. This gate is intentional: the hackathon rules publish `$WIF` as a
requirement but not a canonical address, and a token with the same name and ticker can be
deployed by anyone.

```bash
cp .env.example .env
# edit .env and set VITE_WIF_TOKEN_ADDRESS=0x...
npm run build
```

The address currently recorded as a **candidate** is:

```
0x5173b8eA6923c2d40267890D45C46a3480954773
```

Read directly from Robinhood Chain over RPC, it reports:

| Field | Value |
| --- | --- |
| `name()` | World is Flat |
| `symbol()` | WIF |
| `decimals()` | 18 |
| `chainId` | 4663 |

That is strong evidence but **not** proof of canonicality. Do not enable mainnet payment
until the organizer confirms the address through an official channel.

Until then, invoices are composed against the candidate address so the flow can be
demonstrated, and the pay button shows the reason it is locked.

### What flips when you set it

Setting `VITE_WIF_TOKEN_ADDRESS` switches on the pay button and, at the same time, changes
what counts as a valid invoice. Read this before flipping it on the day:

1. **Invoices signed before the flip still name the candidate address.** Check 04 compares
   an invoice's token against the one this build pins, so an older link will fail that
   check and stay locked. That is the gate working, but it means a link you shared earlier
   cannot be paid afterwards.
2. **Regenerate the sample invoice** so it names the pinned contract:

   ```bash
   node --env-file=.env scripts/make-demo-invoice.mjs
   ```

3. **The sample pays a publicly known address.** Its private key is committed in
   `scripts/make-demo-invoice.mjs`, so the app refuses payment to the sample even with
   payments enabled. To demo a real transfer, create an invoice paying an address you
   control.

---

## Chain configuration

| | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | 4663 | 46630 |
| Currency | ETH | ETH |
| Explorer | `robinhoodchain.blockscout.com` | `explorer.testnet.chain.robinhood.com` |

The public RPC (`https://rpc.mainnet.chain.robinhood.com`) is rate-limited. For a hosted
submission, point `VITE_RPC_URL` at a provider endpoint. Never commit a provider key that
grants write access.

---

## How verification works

The payee signs EIP-712 typed data — not an opaque "sign this message" string. The signed
structure binds:

`payee`, `token`, `amount`, `chainId`, `invoiceId`, `issuedAt`, `expiresAt`,
`referenceHash`

The payer's checks are intentionally **separate rows**, so a green tick on one never
implies another:

| # | Check | Meaning |
| --- | --- | --- |
| 01 | Invoice signature | The typed fields recover to the stated payee |
| 02 | Saved payee record | This address is in the payer's local contact book |
| 03 | Destination change | The invoice address matches the saved address |
| 04 | Token contract | Matches the pinned `$WIF` contract |
| 05 | Network | Chain 4663 |
| 06 | Expiry | Not past its expiry |
| 07 | Amount | Non-zero |

Payment unlocks only when nothing **fails**. A first-time payee is a **warning**, not a
pass, and requires an explicit acknowledgement that the payer verified the address
through a contact route they already trust.

After the wallet sends, the app waits for the receipt and verifies a `Transfer` event
from the pinned contract, from the payer, to the payee, for the exact raw amount, in a
transaction with `status === 'success'`. A success receipt alone is not accepted as
proof of the right transfer.

---

## Address changes

A new invoice signed by a new wallet does **not** establish that the new address belongs
to the previously known payee. If the destination differs from the saved record, the app
blocks payment and tells the payer to re-establish trust out of band.

This build does **not** implement a two-wallet rotation co-sign. That would let the old
and new keys jointly assert continuity, but it is not implemented here, and the app never
pretends continuity it cannot prove.

---

## Privacy and local data

- Stored in `localStorage`: the payer's payee book, invoice references, and transaction
  receipts. Nothing else.
- No accounts, no analytics, no server.
- Clearing browser storage deletes the payee book. It does not sync between devices.
- Invoice data travels in the URL **fragment**, which is not sent in HTTP requests but can
  remain in browser history. Do not put personal data in an invoice reference.

---

## Deployment

The build is a static bundle and works on any static host. `base` is `./`, so it runs from
a subpath without configuration.

```bash
npm run build
# deploy the contents of dist/
```

For GitHub Pages, `.github/workflows/deploy.yml` builds the app, runs the full test suite,
and publishes `dist/` on every push to `main`. Enable it once under **Settings → Pages →
Source: GitHub Actions**. Tests run before the deploy step, so a failing check never ships.

Until Pages is switched on there is no hosted build — the app runs from `npm run dev`.

---

## Project layout

```
src/
├── app/            routes and shell
├── components/     invoice sheet, checks, receipt, UI primitives
├── screens/        start, create (payee), review (payer)
├── lib/
│   ├── chain.ts    chain IDs, RPC, explorer, pinned token
│   ├── eip712.ts   typed-data schema, recovery, URL codec
│   ├── erc20.ts    direct transfer and Transfer-log verification
│   ├── verify.ts   the seven checks and the payment gate
│   ├── local-store.ts  versioned local payee book and history
│   ├── format.ts   base-unit amount parsing and display
│   └── wallet.ts   EIP-1193 injected-wallet adapter
└── styles/         design tokens and layout
tests/              signature, mutation, expiry, gate and receipt cases
```

---

## Known limitations

- Desktop injected wallets only. No WalletConnect, so no mobile-wallet testing.
- No cross-device payee sync, and no global one-time invoice settlement.
- Not independently security-reviewed. This is a hackathon build.
- The visual design is a working direction, not a finished brand.
