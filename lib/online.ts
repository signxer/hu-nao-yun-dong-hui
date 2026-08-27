import type { GameState } from './game.ts';
import type { GameCommand, PresentationEvent } from './presentation.ts';

export interface RoomCredentials { roomCode: string; playerId: string; reconnectToken: string; snapshot: GameState; }
export interface PresenceState { playerId: string; name: string; ready: boolean; connected: boolean; isHost: boolean; }
export type RoomMessage =
  | { type: 'room.snapshot'; snapshot: GameState }
  | { type: 'room.events'; version: number; events: PresentationEvent[] }
  | { type: 'room.presence'; players: PresenceState[] }
  | { type: 'room.error'; commandId?: string; code: string; message: string };

const base = () => (typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_ROOM_API || window.location.origin));
const request = async (path: string, body: unknown) => {
  const response = await fetch(`${base()}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json() as RoomCredentials & { code?: string };
  if (!response.ok) throw new Error(payload.code || 'ROOM_REQUEST_FAILED'); return payload;
};

export const createRoom = (nickname: string) => request('/api/rooms', { nickname });
export const joinRoom = (code: string, nickname: string, reconnectToken?: string) => request(`/api/rooms/${code.toUpperCase()}/join`, { nickname, reconnectToken });

export class RoomConnection {
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private closedByClient = false;
  constructor(private credentials: RoomCredentials, private onMessage: (message: RoomMessage) => void, private onState: (state: 'connecting' | 'connected' | 'disconnected') => void) {}
  connect() {
    this.closedByClient = false;
    const origin = new URL(base()); origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
    origin.pathname = `/api/rooms/${this.credentials.roomCode}/socket`; origin.search = new URLSearchParams({ playerId: this.credentials.playerId, token: this.credentials.reconnectToken }).toString();
    this.onState('connecting'); this.socket = new WebSocket(origin); this.socket.onopen = () => { this.retryCount = 0; this.onState('connected'); }; this.socket.onclose = () => { this.onState('disconnected'); if (!this.closedByClient) { const delay = Math.min(10_000, 500 * 2 ** this.retryCount++); this.retryTimer = setTimeout(() => this.connect(), delay); } }; this.socket.onmessage = (event) => this.onMessage(JSON.parse(event.data) as RoomMessage);
  }
  send(snapshot: GameState, command: GameCommand) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('ROOM_DISCONNECTED');
    this.socket.send(JSON.stringify({ commandId: crypto.randomUUID(), playerId: this.credentials.playerId, reconnectToken: this.credentials.reconnectToken, expectedVersion: snapshot.version ?? 0, command }));
  }
  close() { this.closedByClient = true; if (this.retryTimer) clearTimeout(this.retryTimer); this.retryTimer = null; this.socket?.close(1000, 'client exit'); this.socket = null; }
}
