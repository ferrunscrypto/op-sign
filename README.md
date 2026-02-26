# OP-Sign — Decentralized Document Notary on Bitcoin L1

OP-Sign is a trustless document notarization protocol built on [OPNet](https://opnet.org), Bitcoin's Layer 1 smart contract platform. It lets anyone prove that a specific document existed at a specific Bitcoin block height, attested by a specific signer — with no intermediaries, no servers, and no trusted third parties.

**Live frontend:** https://opnet-sign.pages.dev
**Testnet contract:** `opt1sqr4hgwx39vyjdvcqqlaqpwsuz7r6qsfrwq7esucf`

---

## How It Works

Documents are **never stored on-chain**. Only their SHA-256 hash is submitted. This means:

- The document's existence and integrity are provable forever
- The document's contents remain private
- Storage costs are minimal (32 bytes per document)

When a document is signed, the contract records:
- The SHA-256 hash of the document
- The signer's OPNet address
- The Bitcoin block height at time of signing

Anyone can then verify any document hash against the chain with no trusted backend.

---

## Contract Methods

| Method | Type | Description |
|---|---|---|
| `_signDocument(hash)` | Write | Register a document hash on-chain |
| `_revokeDocument(hash)` | Write | Revoke a document (original signer only) |
| `_verifyDocument(hash)` | Read | Returns `exists`, `signer`, `blockHeight`, `revoked` |
| `_getDocCount()` | Read | Total documents notarised platform-wide |
| `_getSignerDocCount(address)` | Read | Documents signed by a specific address |

---

## Frontend Tabs

### Sign
Drag-and-drop or browse any file. The SHA-256 hash is computed entirely in-browser via the Web Crypto API — the file never leaves your machine. Once hashed, submit the fingerprint on-chain with one click. After confirmation you can download a plain-text **notarisation certificate** containing the hash, signer address, transaction ID, and an explorer link.

### Verify
Re-upload any file (or paste a hash directly) to query its on-chain record. No wallet required — this is a read-only call. Results show:
- **Verified (Active)** — signer address, block height, approximate date
- **Revoked** — original signer address, revocation status
- **Not Found** — no record exists for this hash

### My Documents
A locally tracked list of every document you have signed from the current wallet, with live on-chain status verified on each load:
- **Active / Revoked / Not found** badges with block height and sign date
- **Transaction link** to the OPNet explorer for each signing event
- **Revoke** button — on-chain revocation available to the original signer
- **Add by hash** — manually track a document signed from another device by pasting its hash

Documents are stored in `localStorage` scoped per wallet address. Legacy documents from earlier sessions are automatically migrated.

### Stats
- Platform-wide total document count
- Per-address lookup: enter any `opt1…` address to see how many documents that signer has notarised

---

## Project Structure

```
op_sign/
├── contract/               # AssemblyScript smart contract
│   ├── src/
│   │   └── OpSign.ts       # Main contract
│   ├── abis/               # Auto-generated ABI files
│   ├── tests/              # Simulation, integration & regression tests
│   ├── deploy.mjs          # Deployment script
│   └── package.json
└── frontend/               # React frontend
    ├── src/
    │   ├── components/     # SignTab, VerifyTab, MyDocumentsTab, StatsBar
    │   ├── hooks/          # useOpSign, useProvider
    │   ├── utils/          # hashDocument, resolveAddress, documentStore
    │   └── config/         # Contract addresses, network config
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [OP_WALLET](https://opnet.org) browser extension
- Testnet BTC from the [OPNet faucet](https://faucet.opnet.org)

### Run the Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

### Run Contract Tests

```bash
cd contract
npm install
npm test
```

### Deploy the Contract

Copy `.env.example` to `.env` and fill in your mnemonic, then:

```bash
cd contract
node deploy.mjs
```

---

## Security Properties

- **Immutability** — once signed, a document hash cannot be altered or deleted
- **No document storage** — raw document contents never touch the chain
- **Signer-only revocation** — only the original signer can revoke their document
- **Trustless verification** — anyone can verify any hash directly against the Bitcoin L1 state

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | AssemblyScript + OPNet btc-runtime |
| Blockchain | Bitcoin L1 via OPNet (Tapscript calldata) |
| Frontend | React 19 + Vite |
| Wallet | OP_WALLET (WalletConnect) |
| Hosting | Cloudflare Pages |

---

## License

MIT
