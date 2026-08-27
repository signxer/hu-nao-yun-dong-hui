import { createGame, createPlayers, makeRoomCode, type GameState } from '../lib/game.ts';
import { dispatchCommand, makeInitialDraft, type GameCommand, type PresentationEvent } from '../lib/presentation.ts';

interface Env { GAME_ROOMS: DurableObjectNamespace; }
interface PresenceState { playerId: string; name: string; ready: boolean; connected: boolean; isHost: boolean; }
interface RoomPlayer { id: string; name: string; reconnectToken: string; ready: boolean; joinedAt: number; disconnectedAt?: number; }
interface RoomRecord { code: string; hostId: string; players: RoomPlayer[]; snapshot: GameState; commands: string[]; touchedAt: number; }
interface CommandEnvelope { commandId: string; playerId: string; reconnectToken: string; expectedVersion: number; command: GameCommand; }

type ServerMessage =
  | { type: 'room.snapshot'; snapshot: GameState }
  | { type: 'room.events'; version: number; events: PresentationEvent[] }
  | { type: 'room.presence'; players: PresenceState[] }
  | { type: 'room.error'; commandId?: string; code: string; message: string };

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } });
const randomId = () => crypto.randomUUID();

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const body = await request.json().catch(() => ({})) as { nickname?: string };
      const code = makeRoomCode(); const id = env.GAME_ROOMS.idFromName(code); const stub = env.GAME_ROOMS.get(id);
      return stub.fetch(new Request(`${url.origin}/internal/create`, { method: 'POST', body: JSON.stringify({ code, nickname: body.nickname }) }));
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/(join|socket)$/);
    if (!match) return json({ error: 'NOT_FOUND' }, 404);
    const [, code, action] = match; const stub = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(code));
    if (action === 'join') return stub.fetch(new Request(`${url.origin}/internal/join`, { method: 'POST', body: request.body, headers: request.headers }));
    return stub.fetch(new Request(`${url.origin}/internal/socket${url.search}`, { headers: request.headers }));
  },
} satisfies ExportedHandler<Env>;

export class GameRoom {
  constructor(private state: DurableObjectState, private env: Env) { void this.env; }

  private async read(): Promise<RoomRecord | null> { return (await this.state.storage.get<RoomRecord>('room')) ?? null; }
  private async write(room: RoomRecord) { room.touchedAt = Date.now(); await this.state.storage.put('room', room); await this.state.storage.setAlarm(Date.now() + 2 * 60 * 60 * 1000); }
  private presence(room: RoomRecord): PresenceState[] {
    const connected = new Set(this.state.getWebSockets().map((socket) => (socket.deserializeAttachment() as { playerId?: string } | null)?.playerId).filter(Boolean));
    return room.players.map((player) => ({ playerId: player.id, name: player.name, ready: player.ready, connected: connected.has(player.id), isHost: player.id === room.hostId }));
  }
  private broadcast(message: ServerMessage) { const payload = JSON.stringify(message); this.state.getWebSockets().forEach((socket) => { try { socket.send(payload); } catch { /* stale sockets are removed by the runtime */ } }); }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === '/internal/create' && request.method === 'POST') {
      if (await this.read()) return json({ code: 'ROOM_EXISTS' }, 409);
      const body = await request.json() as { code: string; nickname?: string }; const player: RoomPlayer = { id: randomId(), name: String(body.nickname || '房主').slice(0, 18), reconnectToken: randomId(), ready: true, joinedAt: Date.now() };
      const snapshot = createGame('online', 'zh'); snapshot.phase = 'room'; snapshot.roomCode = body.code; snapshot.players = [];
      const room: RoomRecord = { code: body.code, hostId: player.id, players: [player], snapshot, commands: [], touchedAt: Date.now() }; await this.write(room);
      return json({ roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken, snapshot });
    }
    if (url.pathname === '/internal/join' && request.method === 'POST') {
      const room = await this.read(); if (!room) return json({ code: 'ROOM_NOT_FOUND' }, 404);
      const body = await request.json() as { nickname?: string; reconnectToken?: string };
      const reconnect = body.reconnectToken ? room.players.find((player) => player.reconnectToken === body.reconnectToken && (!player.disconnectedAt || Date.now() - player.disconnectedAt < 300_000)) : undefined;
      const player = reconnect ?? (room.players.length < 6 ? { id: randomId(), name: String(body.nickname || '玩家').slice(0, 18), reconnectToken: randomId(), ready: false, joinedAt: Date.now() } : null);
      if (!player) return json({ code: 'ROOM_FULL' }, 409); if (!reconnect) room.players.push(player); else { player.name = String(body.nickname || player.name).slice(0, 18); player.disconnectedAt = undefined; }
      await this.write(room); this.broadcast({ type: 'room.presence', players: this.presence(room) });
      return json({ roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken, snapshot: room.snapshot });
    }
    if (url.pathname === '/internal/socket') {
      const room = await this.read(); if (!room) return json({ code: 'ROOM_NOT_FOUND' }, 404);
      const playerId = url.searchParams.get('playerId'); const token = url.searchParams.get('token'); const player = room.players.find((item) => item.id === playerId && item.reconnectToken === token);
      if (!player || request.headers.get('upgrade') !== 'websocket') return json({ code: 'UNAUTHORIZED' }, 401);
      const pair = new WebSocketPair(); const [client, server] = Object.values(pair); this.state.acceptWebSocket(server); server.serializeAttachment({ playerId: player.id }); player.disconnectedAt = undefined; await this.write(room);
      server.send(JSON.stringify({ type: 'room.snapshot', snapshot: room.snapshot } satisfies ServerMessage)); this.broadcast({ type: 'room.presence', players: this.presence(room) });
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ code: 'NOT_FOUND' }, 404);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    const room = await this.read(); if (!room || typeof message !== 'string') return;
    const attachment = socket.deserializeAttachment() as { playerId: string };
    let envelope: CommandEnvelope; try { envelope = JSON.parse(message) as CommandEnvelope; } catch { socket.send(JSON.stringify({ type: 'room.error', code: 'BAD_JSON', message: '无法读取指令。' } satisfies ServerMessage)); return; }
    const player = room.players.find((item) => item.id === envelope.playerId && item.id === attachment.playerId && item.reconnectToken === envelope.reconnectToken);
    const reject = (code: string, text: string) => socket.send(JSON.stringify({ type: 'room.error', commandId: envelope.commandId, code, message: text } satisfies ServerMessage));
    if (!player) return reject('UNAUTHORIZED', '身份校验失败。');
    if (room.commands.includes(envelope.commandId)) return reject('DUPLICATE_COMMAND', '该指令已经处理。');
    if ((room.snapshot.version ?? 0) !== envelope.expectedVersion) return reject('STALE_VERSION', '房间状态已经更新，请重试。');
    if (envelope.command.type === 'decision.resolve' && envelope.command.promptId === 'room.ready') {
      player.ready = envelope.command.choice === 'ready'; room.commands = [...room.commands.slice(-127), envelope.commandId]; await this.write(room); this.broadcast({ type: 'room.presence', players: this.presence(room) }); return;
    }
    if (envelope.command.type === 'decision.resolve' && envelope.command.promptId === 'room.start') {
      if (player.id !== room.hostId) return reject('HOST_ONLY', '仅房主可以开始比赛。');
      const ready = room.players.filter((item) => item.ready); if (ready.length < 2) return reject('NOT_READY', '至少需要两名已准备玩家。');
      let snapshot = createGame('online', 'zh'); snapshot.players = createPlayers('local', ready.length).map((item, index) => ({ ...item, id: ready[index].id, name: ready[index].name, isAi: false })); snapshot.roomCode = room.code; snapshot.phase = 'draft'; snapshot = makeInitialDraft(snapshot, Math.floor((snapshot.rngState ?? 0) % ready.length)); snapshot.version = (room.snapshot.version ?? 0) + 1; room.snapshot = snapshot; room.commands = [...room.commands.slice(-127), envelope.commandId]; await this.write(room); this.broadcast({ type: 'room.snapshot', snapshot }); return;
    }
    if (envelope.command.type === 'race.next' || envelope.command.type === 'game.rematch') { if (player.id !== room.hostId) return reject('HOST_ONLY', '仅房主可以执行此操作。'); }
    if (envelope.command.type === 'draft.pick') { const actorIndex = room.snapshot.draftState?.order[room.snapshot.draftState.pick]; if (actorIndex === undefined || room.snapshot.players[actorIndex]?.id !== player.id) return reject('OUT_OF_TURN', '还没有轮到你选择角色。'); }
    if (envelope.command.type === 'race.select' && room.snapshot.players[room.snapshot.raceSelectPlayer]?.id !== player.id) return reject('OUT_OF_TURN', '还没有轮到你选择出战角色。');
    if (envelope.command.type === 'decision.resolve' && envelope.command.promptId === 'mastermind') { const mastermind = room.snapshot.racers.find((racer) => (racer.power ?? racer.name) === 'Mastermind'); if (!mastermind || mastermind.ownerId !== player.id) return reject('FORBIDDEN', '只有阴谋家的玩家可以做出预言。'); }
    if (envelope.command.type === 'decision.resolve' && room.snapshot.pendingDecision?.id === envelope.command.promptId) { const decidingRacer = room.snapshot.racers.find((racer) => racer.id === room.snapshot.pendingDecision?.racerId); if (!decidingRacer || decidingRacer.ownerId !== player.id) return reject('FORBIDDEN', '只有该角色的玩家可以做出选择。'); }
    const activePlayer = room.snapshot.players[room.snapshot.currentPlayer];
    if (room.snapshot.phase === 'race' && activePlayer && activePlayer.id !== player.id) return reject('OUT_OF_TURN', '还没有轮到你。');
    const resolution = dispatchCommand(room.snapshot, envelope.command); room.snapshot = resolution.snapshot; room.commands = [...room.commands.slice(-127), envelope.commandId]; await this.write(room);
    this.broadcast({ type: 'room.events', version: room.snapshot.version ?? 0, events: resolution.events }); this.broadcast({ type: 'room.snapshot', snapshot: room.snapshot });
  }

  async webSocketClose(socket: WebSocket) {
    const room = await this.read(); if (!room) return; const playerId = (socket.deserializeAttachment() as { playerId?: string } | null)?.playerId; const player = room.players.find((item) => item.id === playerId); if (player) player.disconnectedAt = Date.now();
    if (room.hostId === playerId) { const nextHost = room.players.filter((item) => item.id !== playerId && item.ready).sort((a, b) => a.joinedAt - b.joinedAt)[0]; if (nextHost) room.hostId = nextHost.id; }
    await this.write(room); this.broadcast({ type: 'room.presence', players: this.presence(room) });
  }

  async alarm() { const room = await this.read(); if (room && Date.now() - room.touchedAt >= 2 * 60 * 60 * 1000 && this.state.getWebSockets().length === 0) await this.state.storage.deleteAll(); }
}
