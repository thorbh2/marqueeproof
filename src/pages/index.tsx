import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import styles from '../styles/Home.module.css';
import { studionetChainId } from '../wagmi';
import {
  CONTRACT_ADDRESS,
  type Bootstrap,
  type MarqueeShow,
  type TxToast,
  explorerContract,
  explorerTx,
  friendlyError,
  getBootstrap,
  hasContract,
  shortHex,
  waitAccepted,
  writeMethod,
} from '../lib/marqueeproof';

const DOCS = 'https://docs.genlayer.com/';
const WEB = 'https://docs.genlayer.com/developers/intelligent-contracts/features/web-access';
const SECURITY = 'https://docs.genlayer.com/developers/intelligent-contracts/security-and-best-practices/prompt-injection';
const WHITEPAPER = 'https://www.genlayer.com/whitepaper';

const fallbackShows: MarqueeShow[] = [
  {
    id: '0',
    title: 'Glasshouse midnight premiere',
    venue: 'Aster Hall',
    showDate: '2026-07-18',
    claim: 'Official event page, venue proof, ticket batch and door samples resolve to the same performance.',
    officialUrl: DOCS,
    status: 'SETTLED',
    verdict: 'authentic',
    confidenceBps: 9100,
    venueMatchBps: 8800,
    ticketRiskBps: 1400,
    ticketsIssued: 620,
    ticketsChecked: 44,
    summary: 'Venue identity and ticket trail line up cleanly.',
    riskFlags: ['LOW_TICKET_RISK'],
  },
  {
    id: '1',
    title: 'Rooftop matinee transfer',
    venue: 'North Canopy',
    showDate: '2026-08-03',
    claim: 'Transfer listing is public, but settlement waits for a stronger venue-side proof.',
    officialUrl: WEB,
    status: 'CHALLENGED',
    verdict: 'mixed',
    confidenceBps: 6700,
    venueMatchBps: 6100,
    ticketRiskBps: 3900,
    ticketsIssued: 240,
    ticketsChecked: 17,
    summary: 'Listing exists; ticket source needs cleaner reconciliation.',
    riskFlags: ['TRANSFER_AMBIGUITY'],
  },
];

const seats = Array.from({ length: 66 }, (_, index) => index);

const Home: NextPage = () => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [selected, setSelected] = useState(0);
  const [toast, setToast] = useState<TxToast>({ kind: 'idle', title: '' });
  const [busy, setBusy] = useState(false);

  const shows = bootstrap?.recentShows?.length ? bootstrap.recentShows : fallbackShows;
  const active = shows[Math.min(selected, shows.length - 1)] || fallbackShows[0];
  const stats = bootstrap?.stats || {
    shows: shows.length,
    venueProofs: 6,
    ticketBatches: 4,
    checkins: 61,
    inspections: 2,
    challenges: 1,
    appeals: 1,
    audits: 19,
  };
  const quality = bootstrap?.quality?.qualityBps ?? 8450;

  const refresh = useCallback(async () => {
    const data = await getBootstrap().catch(() => null);
    setBootstrap(data);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const currentShowId = useMemo(() => String(active.id || '0'), [active.id]);

  const run = useCallback(
    async (label: string, functionName: string, args: unknown[]) => {
      if (!hasContract()) {
        setToast({ kind: 'error', title: 'Contract not deployed yet', detail: 'Deploy MarqueeProof first.' });
        return;
      }
      if (!isConnected || !address) {
        setToast({ kind: 'error', title: 'Connect wallet first', detail: 'RainbowKit wallet is required for writes.' });
        return;
      }
      if (chainId !== studionetChainId) {
        try {
          await switchChainAsync({ chainId: studionetChainId });
        } catch (error) {
          setToast({ kind: 'error', title: 'Wrong network', detail: friendlyError(error) });
          return;
        }
      }
      setBusy(true);
      setToast({ kind: 'pending', title: `${label}: confirm in wallet` });
      try {
        const hash = await writeMethod(address, functionName, args);
        setToast({ kind: 'pending', title: `${label}: waiting for acceptance`, hash });
        await waitAccepted(address, hash);
        setToast({ kind: 'ok', title: `${label}: accepted`, hash });
        await refresh();
      } catch (error) {
        setToast({ kind: 'error', title: `${label} failed`, detail: friendlyError(error) });
      } finally {
        setBusy(false);
      }
    },
    [address, chainId, isConnected, refresh, switchChainAsync],
  );

  const actions = [
    {
      label: 'Open show',
      fn: 'open_show',
      args: [
        'Glasshouse midnight premiere',
        'Aster Hall',
        '2026-07-18',
        'Official event page, venue proof and ticket batch should resolve to the same performance.',
        DOCS,
      ],
    },
    { label: 'Add venue proof', fn: 'add_venue_proof', args: [currentShowId, 'official venue note', DOCS, 'Public venue source linked to the show listing.'] },
    { label: 'Mint ticket batch', fn: 'mint_ticket_batch', args: [currentShowId, 'balcony-first-wave', 620, 4500, WEB] },
    { label: 'Check in ticket', fn: 'check_in_ticket', args: [currentShowId, '0', `MP-${Date.now().toString().slice(-6)}`, 'Door sample from connected wallet session.'] },
    { label: 'Open audit', fn: 'open_audit', args: [currentShowId] },
    { label: 'AI audit', fn: 'audit_show_with_genlayer', args: [currentShowId] },
  ];

  return (
    <div className={styles.shell}>
      <Head>
        <title>MarqueeProof</title>
        <meta name="description" content="GenLayer ticket and venue proof protocol with RainbowKit wallet actions." />
      </Head>

      <main className={styles.workbench}>
        <section className={styles.marquee}>
          <div className={styles.bulbs} />
          <div>
            <span className={styles.eyebrow}>Studionet box office</span>
            <h1>MarqueeProof</h1>
          </div>
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              if (!connected) {
                return <button className={styles.walletButton} onClick={openConnectModal} type="button">Connect wallet</button>;
              }
              if (chain.unsupported) {
                return <button className={styles.walletButtonWarn} onClick={openChainModal} type="button">Switch network</button>;
              }
              return (
                <div className={styles.walletStack}>
                  <button className={styles.chainButton} onClick={openChainModal} type="button">{chain.name}</button>
                  <button className={styles.accountButton} onClick={openAccountModal} type="button">{account.displayName}</button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </section>

        <section className={styles.ticketRail}>
          <div className={styles.railLabel}>Live tickets</div>
          {shows.map((show, index) => (
            <button
              key={`${show.id}-${show.title}`}
              className={`${styles.ticket} ${index === selected ? styles.ticketActive : ''}`}
              onClick={() => setSelected(index)}
              type="button"
            >
              <span>{show.showDate}</span>
              <strong>{show.title}</strong>
              <small>{show.venue} / {show.status}</small>
            </button>
          ))}
        </section>

        <section className={styles.stageMap} aria-label="Marquee seating proof map">
          <div className={styles.stageHeader}>
            <span>House map</span>
            <strong>{active.venue}</strong>
            <a href={hasContract() ? explorerContract() : '#'} target={hasContract() ? '_blank' : undefined} rel="noreferrer">
              {hasContract() ? shortHex(CONTRACT_ADDRESS) : 'contract pending'}
            </a>
          </div>
          <div className={styles.stage}>
            <div className={styles.curtainLeft} />
            <div className={styles.screen}>
              <span>Marquee inspection</span>
              <strong>{active.verdict}</strong>
            </div>
            <div className={styles.curtainRight} />
          </div>
          <div className={styles.seats}>
            {seats.map((seat) => (
              <span
                key={seat}
                className={seat % 11 === 0 ? styles.seatHot : seat % 7 === 0 ? styles.seatWarn : styles.seat}
                style={{ '--delay': `${(seat % 9) * 40}ms` } as React.CSSProperties}
              />
            ))}
          </div>
        </section>

        <section className={styles.booth}>
          <div className={styles.boothTop}>
            <span>Wallet booth</span>
            <strong>{isConnected && address ? shortHex(address) : 'not connected'}</strong>
          </div>
          <div className={styles.metrics}>
            <div><span>Quality</span><b>{Math.round(quality / 100)}%</b></div>
            <div><span>Venue</span><b>{Math.round(Number(active.venueMatchBps || 0) / 100)}%</b></div>
            <div><span>Ticket risk</span><b>{Math.round(Number(active.ticketRiskBps || 0) / 100)}%</b></div>
            <div><span>Issued</span><b>{active.ticketsIssued}</b></div>
          </div>
          <div className={styles.actionBoard}>
            {actions.map((action) => (
              <button
                key={action.fn}
                className={styles.actionKey}
                disabled={busy || !isConnected}
                onClick={() => run(action.label, action.fn, action.args)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
          {toast.kind !== 'idle' && (
            <div className={`${styles.toast} ${styles[`toast_${toast.kind}`]}`}>
              <strong>{toast.title}</strong>
              {toast.detail && <span>{toast.detail}</span>}
              {toast.hash && <a href={explorerTx(toast.hash)} target="_blank" rel="noreferrer">{shortHex(toast.hash, 10, 8)}</a>}
            </div>
          )}
        </section>

        <section className={styles.ledger}>
          <div className={styles.claim}>
            <span>Active claim</span>
            <p>{active.claim}</p>
          </div>
          <div className={styles.statTape}>
            <span>shows {Number(stats.shows || 0)}</span>
            <span>proofs {Number(stats.venueProofs || 0)}</span>
            <span>batches {Number(stats.ticketBatches || 0)}</span>
            <span>check-ins {Number(stats.checkins || 0)}</span>
            <span>AI audits {Number(stats.inspections || 0)}</span>
            <span>filings {Number(stats.challenges || 0) + Number(stats.appeals || 0)}</span>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
