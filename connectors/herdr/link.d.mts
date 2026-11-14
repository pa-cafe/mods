// Types for link.mjs (plain JavaScript, see notify.d.mts).
import type { webcrypto } from 'node:crypto';
export type Connection = { url: string; secret: string; cafe: string | null; house: string | null; connectedAt?: string };
export const DEFAULT_ORIGIN: string;
export const DISCONNECT_BODY: string;
export function connectionPath(env: NodeJS.ProcessEnv): string | null;
export function readConnection(env?: NodeJS.ProcessEnv): Connection | null;
export function saveConnection(env: NodeJS.ProcessEnv, connection: Omit<Connection, 'connectedAt'>): void;
export function forgetConnection(env: NodeJS.ProcessEnv): void;
export function revokeConnection(connection: Pick<Connection, 'url' | 'secret'>): Promise<boolean>;
export function deviceKey(): Promise<{ privateKey: webcrypto.CryptoKey; publicKey: string }>;
export function openHandover(privateKey: webcrypto.CryptoKey, sealed: unknown): Promise<{ url: string; secret: string; house: string; cafe: string }>;
export function signDelivery(secret: string, id: string, timestamp: string, body: string): string | null;
