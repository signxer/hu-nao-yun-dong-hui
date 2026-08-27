import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startRace, type GameState, type RacerName } from '../lib/game.ts';
import { dispatchCommand } from '../lib/presentation.ts';

const selections = (names: RacerName[]) => Object.fromEntries(names.map((name, index) => [`player-${index + 1}`, [name]]));
const race = (names: RacerName[], board: GameState['board'] = 'Mild Mile') => startRace({ ...createGame('local', 'zh'), board }, selections(names));

test('rolling emits a blocking dice event without moving the racer', () => {
  const state = race(['Alchemist', 'Coach', 'Banana', 'Blimp']);
  const result = dispatchCommand(state, { type: 'turn.roll' });
  assert.equal(result.snapshot.racers[0].position, 0);
  assert.equal(result.events[0]?.type, 'dice.rolled');
  assert.equal(result.events[0]?.blocking, 'hard');
});

test('resolving a roll emits movement before the turn change', () => {
  const state = race(['Alchemist', 'Coach', 'Banana', 'Blimp']);
  const rolled = { ...state, rngState: 1 };
  const first = dispatchCommand(rolled, { type: 'turn.roll' });
  const pendingId = `roll-${first.snapshot.pendingRoll?.racerId}`;
  const result = dispatchCommand(first.snapshot, { type: 'decision.resolve', promptId: pendingId, choice: 'none' });
  const moveIndex = result.events.findIndex((event) => event.type === 'racer.moved');
  const turnIndex = result.events.findIndex((event) => event.type === 'turn.changed');
  assert.ok(moveIndex >= 0);
  assert.ok(turnIndex > moveIndex);
});

test('wild arrow path is preserved as forward then backward presentation steps', () => {
  const state = race(['Alchemist', 'Coach', 'Banana', 'Blimp'], 'Wild Wilds');
  state.racers[0].position = 20;
  state.pendingRoll = { racerId: state.racers[0].id, roll: 4, rerollsUsed: 0, start: 20 };
  const result = dispatchCommand(state, { type: 'decision.resolve', promptId: `roll-${state.racers[0].id}`, choice: 'none' });
  const move = result.events.find((event) => event.type === 'racer.moved');
  assert.equal(move?.type, 'racer.moved');
  if (move?.type === 'racer.moved') assert.deepEqual(move.path, [20, 21, 22, 23, 24, 23, 22]);
});

test('fixed snapshots produce identical event sequences', () => {
  const state = race(['Rocket Scientist', 'Coach', 'Banana', 'Blimp']);
  state.pendingRoll = { racerId: state.racers[0].id, roll: 3, rerollsUsed: 0, start: 0 };
  assert.deepEqual(dispatchCommand(state, { type: 'ability.activate', abilityId: 'rocket' }), dispatchCommand(state, { type: 'ability.activate', abilityId: 'rocket' }));
});
