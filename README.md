# MarqueeProof

MarqueeProof is a RainbowKit + GenLayer Studionet project for event, venue and ticket provenance. The app is a theatre-style box office with a real RainbowKit wallet connection, ticket rail, seating map, contract action keys and live contract reads.

## Contract

- Address: `0x1CcD5faA14261bF5290C2fC97ef972f0f9DE0d3d`
- Explorer: <https://explorer-studio.genlayer.com/contracts/0x1CcD5faA14261bF5290C2fC97ef972f0f9DE0d3d>
- Deploy tx: <https://explorer-studio.genlayer.com/tx/0x2d64112842168cdb932d69338010e37c31186ff0e4e801553c7a9c65277ae78c>

## Contract Surface

Source: `contracts/marqueeproof.py`

Write methods include `open_show`, `add_venue_proof`, `mint_ticket_batch`, `check_in_ticket`, `open_audit`, `audit_show_with_genlayer`, `open_challenge_window`, `file_challenge`, `resolve_challenge_with_genlayer`, `file_appeal`, `resolve_appeal_with_genlayer`, `settle_show`, `archive_show`, and `recalculate_reputation`.

Read methods include `get_frontend_bootstrap`, `get_recent_shows`, `get_show`, `get_venue_proofs`, `get_ticket_batches`, `get_checkins`, `get_inspections`, `get_challenges`, `get_appeals`, `get_audit_log`, `get_reputation`, `get_contract_stats`, and `get_quality_score`.

## Local Preview

```powershell
npm install
npm run dev -- -p 4399
```

Open:

```text
http://localhost:4399
```

## Direct App Commands

```powershell
cd <this-repository-folder>
npm run dev -- -p 4399
npm run build
```

## Public Release

- Repository: <https://github.com/aspro45/marqueeproof>
- Framework: Next.js with RainbowKit
- Build: `npm run build`

## Vercel

- Framework: Next.js
- Root directory: `/`
- Build command: `npm run build`
- Output: Next.js default

Optional environment variables:

- `NEXT_PUBLIC_CONTRACT_ADDRESS=0x1CcD5faA14261bF5290C2fC97ef972f0f9DE0d3d`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<walletconnect_project_id>`
- `NEXT_PUBLIC_GENLAYER_RPC=https://studio.genlayer.com/api`
- `NEXT_PUBLIC_GENLAYER_EXPLORER=https://explorer-studio.genlayer.com`
- `NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999`

## Security

Private keys, vault files, `.env.local`, `.vercel/`, wallet exports and local dashboard state must never be committed. The app only stores public contract metadata. Deployer private key is encrypted in the workspace vault outside this project.
