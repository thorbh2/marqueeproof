import { defineChain } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

const GENLAYER_BROWSER_RPC = typeof window === 'undefined'
  ? 'https://studio.genlayer.com/api'
  : `${window.location.origin}/api/genlayer`;
const GENLAYER_HTTP_OPTIONS = { retryCount: 3, retryDelay: 500, timeout: 30_000 } as const;
const rpcUrl = process.env.NEXT_PUBLIC_GENLAYER_RPC || 'https://studio.genlayer.com/api';
const explorerUrl = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || 'https://explorer-studio.genlayer.com';
export const studionetChainId = Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || 61999);

export const studionet = defineChain({
  id: studionetChainId,
  name: 'GenLayer Studionet',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  blockExplorers: { default: { name: 'GenLayer Studio Explorer', url: explorerUrl } },
  testnet: true,
});

export const config = createConfig({
  chains: [studionet],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [studionet.id]: http(GENLAYER_BROWSER_RPC, GENLAYER_HTTP_OPTIONS) },
  ssr: true,
});
