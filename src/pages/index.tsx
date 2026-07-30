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

const EMPTY_SHOW: MarqueeShow = {
  id: '', title: 'No onchain shows', venue: 'Register a show from the wallet booth', showDate: '',
  claim: 'The configured contract did not return any show records. Static fallback outcomes are disabled.',
  officialUrl: '', status: 'EMPTY', verdict: 'not reviewed', confidenceBps: 0, venueMatchBps: 0,
  ticketRiskBps: 0, ticketsIssued: 0, ticketsChecked: 0, summary: '', riskFlags: [],
};

const seats = Array.from({ length: 66 }, (_, index) => index);

const Home: NextPage = () => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [selected, setSelected] = useState(0);
  const [toast, setToast] = useState<TxToast>({ kind: 'idle', title: '' });
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState('');
  const [showTitle, setShowTitle] = useState('');
  const [showVenue, setShowVenue] = useState('');
  const [showDate, setShowDate] = useState('');
  const [showClaim, setShowClaim] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [detail, setDetail] = useState('');
  const [recordId, setRecordId] = useState('');

  const shows = bootstrap?.recentShows ?? [];
  const active = shows[Math.min(selected, Math.max(0, shows.length - 1))] ?? EMPTY_SHOW;
  const hasActive = active.id !== '';
  const stats = bootstrap?.stats ?? {};
  const quality = bootstrap?.quality?.qualityBps ?? 0;

  const refresh = useCallback(async () => {
    try {
      const data = await getBootstrap();
      setBootstrap(data);
      setSelected((value) => Math.min(value, Math.max(0, (data?.recentShows?.length ?? 1) - 1)));
      setReadError(data ? '' : 'The configured contract did not return a bootstrap payload.');
    } catch (error) {
      setBootstrap(null);
      setReadError(friendlyError(error));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const currentShowId = useMemo(() => String(active.id), [active.id]);

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

  const proofReady = /^https?:\/\//i.test(proofUrl.trim());
  const filingReady = detail.trim().length >= 8 && proofReady;
  const idReady = /^\d+$/.test(recordId.trim());
  const actions = [
    { label: 'Add venue proof', fn: 'add_venue_proof', args: [currentShowId, detail || 'Venue proof', proofUrl, detail], enabled: hasActive && filingReady },
    { label: 'Mint ticket batch', fn: 'mint_ticket_batch', args: [currentShowId, detail || 'general admission', 100, 2500, proofUrl], enabled: hasActive && proofReady },
    { label: 'Check in ticket', fn: 'check_in_ticket', args: [currentShowId, recordId, `MP-${Date.now().toString().slice(-6)}`, detail || 'Door check-in'], enabled: hasActive && idReady },
    { label: 'Open audit', fn: 'open_audit', args: [currentShowId], enabled: hasActive },
    { label: 'AI audit', fn: 'audit_show_with_genlayer', args: [currentShowId], enabled: hasActive },
    { label: 'Open challenge window', fn: 'open_challenge_window', args: [currentShowId], enabled: hasActive },
    { label: 'File challenge', fn: 'file_challenge', args: [currentShowId, detail, proofUrl], enabled: hasActive && filingReady },
    { label: 'Resolve challenge', fn: 'resolve_challenge_with_genlayer', args: [currentShowId, recordId], enabled: hasActive && idReady },
    { label: 'File appeal', fn: 'file_appeal', args: [currentShowId, detail, proofUrl], enabled: hasActive && filingReady },
    { label: 'Resolve appeal', fn: 'resolve_appeal_with_genlayer', args: [currentShowId, recordId], enabled: hasActive && idReady },
    { label: 'Settle show', fn: 'settle_show', args: [currentShowId], enabled: hasActive },
  ];

  const openShow = () => {
    if (!showTitle.trim() || !showVenue.trim() || !showDate.trim() || showClaim.trim().length < 8 || !proofReady) {
      setToast({ kind: 'error', title: 'Show form is incomplete', detail: 'Add title, venue, date, claim and a public http(s) source.' });
      return;
    }
    run('Open show', 'open_show', [showTitle.trim(), showVenue.trim(), showDate.trim(), showClaim.trim(), proofUrl.trim()]);
  };

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
          {shows.length === 0 && <div className={styles.emptyTicket}>No show records returned by the configured contract.</div>}
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
            <div className={styles.showForm}>
              <input value={showTitle} onChange={(event) => setShowTitle(event.target.value)} placeholder="Show title" />
              <input value={showVenue} onChange={(event) => setShowVenue(event.target.value)} placeholder="Venue" />
              <input value={showDate} onChange={(event) => setShowDate(event.target.value)} placeholder="Show date" />
              <textarea value={showClaim} onChange={(event) => setShowClaim(event.target.value)} placeholder="Claim checked against public evidence" />
              <button className={styles.actionKey} disabled={busy || !isConnected} onClick={openShow} type="button">Open show</button>
            </div>
            <div className={styles.lifecycleInputs}>
              <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Proof note, challenge or appeal reason" />
              <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="https:// public proof" />
              <input value={recordId} onChange={(event) => setRecordId(event.target.value.replace(/\D/g, ''))} placeholder="Batch / challenge / appeal ID" inputMode="numeric" />
            </div>
            {actions.map((action) => (
              <button
                key={action.fn}
                className={styles.actionKey}
                disabled={busy || !isConnected || !action.enabled}
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
          {readError && <div className={`${styles.toast} ${styles.toast_error}`}><strong>Contract read failed</strong><span>{readError}</span></div>}
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
