// Types for notify.mjs, which stays plain JavaScript so the mod runs on stock Node without a build.
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'unknown';
export type AgentInfo = { agent: string | null; agent_status: AgentStatus; completion_seq?: number | null; state_change_seq: number; terminal_id: string; workspace_id: string; pane_id: string; terminal_title?: string | null };
export type HerdrEvent = { event: 'pane.agent_status_changed'; data: { pane_id: string; workspace_id: string; agent_status: AgentStatus; agent?: string | null; title?: string | null } };
export type HerdrNotifierDependencies = { socketPath: string; serverIdentity?: string; stateDir: string; endpoint: string; secret: string; settleMs?: number; readAgent: (paneId: string) => Promise<AgentInfo | null>; fetcher?: typeof fetch; sleep?: (duration: number) => Promise<void> };
export type HerdrNotifierResult = { sent: boolean; status?: 'done' | 'blocked'; reason?: 'invalid_event' | 'missing_config' | 'read_failed' | 'pane_missing' | 'invalid_snapshot' | 'pane_not_done' | 'pane_changed' | 'scope_mismatch' | 'missing_completion_seq' | 'duplicate' | 'delivery_failed' };
export function notifyHerdrEvent(input: unknown, dependencies: HerdrNotifierDependencies): Promise<HerdrNotifierResult>;
export function runHerdrNotifier(input: unknown, env?: NodeJS.ProcessEnv): Promise<HerdrNotifierResult>;
export function runHerdrNotifierCli(env?: NodeJS.ProcessEnv): Promise<void>;
