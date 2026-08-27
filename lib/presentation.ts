import {
  RACERS,
  activateAbility,
  beginRace,
  createGame,
  nextRace,
  raceSlots,
  resolveDecision,
  resolveRoll,
  rollTurn,
  startRace,
  wildEffects,
  type AbilityActionId,
  type GameState,
  type RacerName,
  type TurnChoice,
} from './game.ts';

export type BlockingLevel = 'none' | 'soft' | 'hard';

interface EventMeta {
  id: string;
  seq: number;
  blocking: BlockingLevel;
  durationMs: number;
}

export type PresentationEvent = EventMeta & (
  | { type: 'dice.rolled'; racerId: string; value: number }
  | { type: 'ability.prompted'; racerId: string; abilityId: string }
  | { type: 'ability.activated'; racerId: string; abilityId: string; targets: string[] }
  | { type: 'racer.moved'; racerId: string; path: number[]; reason: 'main' | 'ability' | 'space' }
  | { type: 'space.triggered'; racerId: string; space: number; effect: string }
  | { type: 'status.changed'; racerId: string; status: 'tripped' | 'eliminated' | 'recovered' }
  | { type: 'score.changed'; playerId: string; delta: number; reason: string }
  | { type: 'race.finished'; racerId: string; place: 1 | 2 }
  | { type: 'turn.changed'; playerId: string; racerId: string }
  | { type: 'race.ended'; standings: string[] }
);

type RawPresentationEvent = PresentationEvent extends infer Event
  ? Event extends EventMeta ? Omit<Event, keyof EventMeta> : never
  : never;

export type GameCommand =
  | { type: 'draft.pick'; racer: RacerName }
  | { type: 'race.select'; racers: RacerName[] }
  | { type: 'turn.roll' }
  | { type: 'ability.activate'; abilityId: string; targetId?: string }
  | { type: 'decision.resolve'; promptId: string; choice: string }
  | { type: 'race.next' }
  | { type: 'game.rematch' };

export interface GameResolution {
  snapshot: GameState;
  events: PresentationEvent[];
}

const durationFor = (type: PresentationEvent['type']) => {
  if (type === 'dice.rolled') return 650;
  if (type === 'racer.moved') return 190;
  if (type === 'ability.activated') return 500;
  if (type === 'race.finished') return 1800;
  if (type === 'status.changed') return 620;
  return 180;
};

const blockingFor = (type: PresentationEvent['type']): BlockingLevel => {
  if (type === 'dice.rolled' || type === 'racer.moved' || type === 'ability.activated' || type === 'race.finished' || type === 'status.changed') return 'hard';
  if (type === 'space.triggered' || type === 'score.changed') return 'soft';
  return 'none';
};

const withMeta = <T extends RawPresentationEvent>(state: GameState, event: T, offset: number): PresentationEvent => {
  const seq = (state.presentationSeq ?? 0) + offset + 1;
  return {
    ...event,
    id: `event-${seq}`,
    seq,
    blocking: blockingFor(event.type),
    durationMs: durationFor(event.type),
  } as unknown as PresentationEvent;
};

const straightPath = (from: number, to: number) => {
  const path = [from];
  const direction = Math.sign(to - from);
  for (let cell = from + direction; direction && (direction > 0 ? cell <= to : cell >= to); cell += direction) path.push(cell);
  return path;
};

export function eventsFromTransition(before: GameState, after: GameState, command?: GameCommand): PresentationEvent[] {
  const raw: RawPresentationEvent[] = [];
  const beforeRacers = new Map(before.racers.map((racer) => [racer.id, racer]));

  if (after.pendingRoll && (!before.pendingRoll || before.pendingRoll.roll !== after.pendingRoll.roll || before.pendingRoll.rerollsUsed !== after.pendingRoll.rerollsUsed)) {
    raw.push({ type: 'dice.rolled', racerId: after.pendingRoll.racerId, value: after.pendingRoll.roll });
  }
  if (command?.type === 'ability.activate') {
    raw.push({ type: 'ability.activated', racerId: before.currentRacerId ?? before.pendingRoll?.racerId ?? '', abilityId: command.abilityId, targets: command.targetId ? [command.targetId] : [] });
  }
  if (after.pendingDecision && after.pendingDecision.id !== before.pendingDecision?.id) {
    raw.push({ type: 'ability.prompted', racerId: after.pendingDecision.racerId, abilityId: after.pendingDecision.kind });
  }

  for (const racer of after.racers) {
    const previous = beforeRacers.get(racer.id);
    if (!previous) continue;
    if (previous.position !== racer.position) {
      const recorded = after.lastMovePath;
      const path = recorded?.[0] === previous.position && recorded.at(-1) === racer.position ? recorded : straightPath(previous.position, racer.position);
      const reason = command?.type === 'ability.activate' ? 'ability' : after.board === 'Wild Wilds' && wildEffects[path.at(-1) ?? -1] ? 'space' : 'main';
      raw.push({ type: 'racer.moved', racerId: racer.id, path, reason });
      const effect = after.board === 'Wild Wilds' ? wildEffects[racer.position] : undefined;
      if (effect) raw.push({ type: 'space.triggered', racerId: racer.id, space: racer.position, effect });
    }
    if (!previous.tripped && racer.tripped) raw.push({ type: 'status.changed', racerId: racer.id, status: 'tripped' });
    if (previous.tripped && !racer.tripped) raw.push({ type: 'status.changed', racerId: racer.id, status: 'recovered' });
    if (!previous.eliminated && racer.eliminated) raw.push({ type: 'status.changed', racerId: racer.id, status: 'eliminated' });
  }

  after.players.forEach((player) => {
    const previous = before.players.find((item) => item.id === player.id);
    if (previous && previous.score !== player.score) raw.push({ type: 'score.changed', playerId: player.id, delta: player.score - previous.score, reason: 'race' });
  });
  after.finishers.filter((id) => !before.finishers.includes(id)).forEach((id) => {
    const place = after.finishers.indexOf(id) + 1;
    if (place <= 2) raw.push({ type: 'race.finished', racerId: id, place: place as 1 | 2 });
  });
  if (before.currentRacerId !== after.currentRacerId && after.currentRacerId) {
    const racer = after.racers.find((item) => item.id === after.currentRacerId);
    if (racer) raw.push({ type: 'turn.changed', playerId: racer.ownerId, racerId: racer.id });
  }
  if (before.phase === 'race' && after.phase === 'result') raw.push({ type: 'race.ended', standings: after.finishers });

  return raw.map((event, index) => withMeta(before, event, index));
}

function applyCommand(snapshot: GameState, command: GameCommand): GameState {
  if (command.type === 'turn.roll') return rollTurn(snapshot, snapshot.currentRacerId ?? undefined);
  if (command.type === 'ability.activate') {
    if (snapshot.pendingRoll) return resolveRoll(snapshot, command.abilityId as TurnChoice);
    return activateAbility(snapshot, snapshot.currentRacerId ?? '', command.abilityId as AbilityActionId, command.targetId);
  }
  if (command.type === 'decision.resolve') {
    if (command.promptId === 'mastermind') { const mastermind = snapshot.racers.find((racer) => (racer.power ?? racer.name) === 'Mastermind'); const target = snapshot.racers.find((racer) => racer.id === command.choice); return mastermind && target ? { ...structuredClone(snapshot), mastermindPrediction: { mastermindId: mastermind.id, targetId: target.id } } : snapshot; }
    if (snapshot.pendingDecision?.id === command.promptId) return resolveDecision(snapshot, command.choice as RacerName);
    if (snapshot.pendingRoll && command.promptId === `roll-${snapshot.pendingRoll.racerId}`) return resolveRoll(snapshot, command.choice as TurnChoice);
    return snapshot;
  }
  if (command.type === 'race.select') {
    if (snapshot.phase !== 'race-select') return snapshot;
    const player = snapshot.players[snapshot.raceSelectPlayer];
    const used = new Set(snapshot.usedRacers ?? []);
    const slots = raceSlots(snapshot.players.length);
    if (!player || command.racers.length !== slots || command.racers.some((name) => !player.team.includes(name) || used.has(name))) return snapshot;
    const selections = { ...snapshot.raceSelections, [player.id]: command.racers };
    return snapshot.raceSelectPlayer + 1 >= snapshot.players.length
      ? startRace({ ...snapshot, raceSelections: selections }, selections)
      : { ...snapshot, raceSelections: selections, raceSelectPlayer: snapshot.raceSelectPlayer + 1 };
  }
  if (command.type === 'race.next') return nextRace(snapshot);
  if (command.type === 'game.rematch') return createGame(snapshot.mode, snapshot.locale);
  if (command.type === 'draft.pick') {
    const draft = snapshot.draftState;
    if (snapshot.phase !== 'draft' || !draft || !draft.pool.includes(command.racer)) return snapshot;
    const actorIndex = draft.order[draft.pick];
    const actor = snapshot.players[actorIndex];
    if (!actor || actor.team.length >= 4) return snapshot;
    const players = snapshot.players.map((player, index) => index === actorIndex ? { ...player, team: [...player.team, command.racer] } : player);
    const nextPick = draft.pick + 1; const total = snapshot.players.length * 4;
    if (nextPick >= total) return beginRace({ ...snapshot, players, draftState: undefined });
    const remaining = draft.pool.filter((name) => name !== command.racer);
    const used = new Set(players.flatMap((player) => player.team));
    const pool = remaining.length ? remaining : RACERS.filter((card) => !used.has(card.name)).slice(0, snapshot.players.length * 2).map((card) => card.name);
    return { ...snapshot, players, draftState: { ...draft, pick: nextPick, pool } };
  }
  return snapshot;
}

export function dispatchCommand(snapshot: GameState, command: GameCommand): GameResolution {
  const before = structuredClone(snapshot);
  const resolved = applyCommand(before, command);
  const events = eventsFromTransition(snapshot, resolved, command);
  const changed = JSON.stringify(resolved) !== JSON.stringify(snapshot);
  const next = {
    ...resolved,
    version: (snapshot.version ?? 0) + (changed ? 1 : 0),
    presentationSeq: events.at(-1)?.seq ?? snapshot.presentationSeq ?? 0,
  };
  return { snapshot: next, events };
}

export function makeInitialDraft(snapshot: GameState, startPlayer = 0): GameState {
  const forward = Array.from({ length: snapshot.players.length }, (_, index) => (startPlayer + index) % snapshot.players.length);
  const snake = [...forward, ...[...forward].reverse()];
  return {
    ...snapshot,
    draftState: {
      pick: 0,
      startPlayer,
      order: [...snake, ...snake.map((index) => (index + 1) % snapshot.players.length)],
      pool: RACERS.slice(0, snapshot.players.length * 2).map((card) => card.name),
    },
  };
}

export const describeEvent = (event: PresentationEvent) => {
  if (event.type === 'dice.rolled') return `掷出 ${event.value}`;
  if (event.type === 'racer.moved') return `移动 ${Math.max(0, event.path.length - 1)} 步`;
  if (event.type === 'ability.activated') return `发动 ${event.abilityId}`;
  if (event.type === 'space.triggered') return `触发 ${event.effect}`;
  if (event.type === 'race.finished') return `获得第 ${event.place} 名`;
  if ('racerId' in event) return event.racerId;
  return event.type;
};
