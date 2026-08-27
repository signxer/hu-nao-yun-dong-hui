import assert from 'node:assert/strict';
import test from 'node:test';
import { RACERS, abilityActions, activateAbility, createGame, resolveDecision, resolveRoll, rollTurn, startRace, takeTurn, type GameState, type RacerName } from '../lib/game.ts';

const map = (names: RacerName[]) => Object.fromEntries(names.map((name, index) => [`player-${index + 1}`, [name]]));
const race = (names: RacerName[]) => startRace(createGame('local', 'zh'), map(names));

test('all 36 racers have localized rules and deterministic stats', () => {
  assert.equal(RACERS.length, 36);
  for (const card of RACERS) {
    assert.ok(card.zhName.length >= 2, card.name);
    assert.ok(card.zhAbility.length >= 8, card.name);
    assert.ok(Number.isFinite(card.speed), card.name);
  }
});

test('Centaur hoofwhacks every racer it passes', () => {
  const state = race(['Centaur', 'Coach', 'Banana', 'Blimp']); state.racers[1].position = 2;
  const next = takeTurn(state, state.racers[0].id, { forcedRoll: 3 });
  assert.equal(next.racers[0].position, 3); assert.equal(next.racers[1].position, 0);
});

test('Dicemonger grants one reroll and moves before the rerolled racer', () => {
  const state = race(['Coach', 'Dicemonger', 'Banana', 'Blimp']);
  const rolled = rollTurn(state, state.racers[0].id, 2);
  const rerolled = resolveRoll(rolled, 'reroll', 5);
  assert.equal(rerolled.pendingRoll?.roll, 5); assert.equal(rerolled.racers[1].position, 1); assert.equal(rerolled.racers[0].position, 0);
});

test('Suckerfish resolves after the racer it follows', () => {
  const state = race(['Coach', 'Suckerfish', 'Banana', 'Blimp']); state.racers[0].position = 28; state.racers[1].position = 28;
  const next = takeTurn(state, state.racers[0].id, { forcedRoll: 2 });
  assert.deepEqual(next.finishers.slice(0, 2), [state.racers[0].id, state.racers[1].id]);
});

test('Flip Flop swaps simultaneously and consumes the main move', () => {
  const state = race(['Flip Flop', 'Coach', 'Banana', 'Blimp']); state.racers[0].position = 3; state.racers[1].position = 8;
  const next = activateAbility(state, state.racers[0].id, 'flip-flop', state.racers[1].id);
  assert.equal(next.racers[0].position, 8); assert.equal(next.racers[1].position, 3); assert.equal(next.currentPlayer, 1);
});

test('Third Wheel warps to a pair and keeps its main move available', () => {
  const state = race(['Third Wheel', 'Coach', 'Banana', 'Blimp']); state.racers[0].position = 2; state.racers[1].position = 10; state.racers[2].position = 10;
  const option = abilityActions(state, state.racers[0]).find((item) => item.id === 'third-wheel');
  assert.deepEqual(option?.targetIds, [state.racers[1].id, state.racers[2].id]);
  const warped = activateAbility(state, state.racers[0].id, 'third-wheel', state.racers[1].id);
  assert.equal(warped.racers[0].position, 10);
  assert.equal(warped.currentPlayer, 0);
  assert.equal(warped.currentRacerId, state.racers[0].id);
  assert.equal(warped.pendingRoll, null);
  assert.deepEqual(warped.lastMovePath, [2, 10]);
  const rolled = rollTurn(warped, warped.racers[0].id, 3);
  assert.equal(rolled.pendingRoll?.start, 10);
});

test('Party Animal is a mandatory start trigger and happens once', () => {
  const state = race(['Party Animal', 'Coach', 'Banana', 'Blimp']); state.racers[0].position = 5; state.racers[1].position = 2;
  const rolled = rollTurn(state, state.racers[0].id, 1);
  assert.equal(rolled.racers[1].position, 3);
});

test('Egg copying Sisyphus receives its before-race chips', () => {
  const state = race(['Egg', 'Coach', 'Banana', 'Blimp']);
  state.pendingDecision = { id: 'egg-test', kind: 'egg', racerId: state.racers[0].id, choices: ['Sisyphus'] };
  const next = resolveDecision(state, 'Sisyphus');
  assert.equal(next.racers[0].power, 'Sisyphus'); assert.equal(next.racers[0].chips, 4);
});

test('Rocket Scientist doubles once and remains tripped for its next turn', () => {
  const state = race(['Rocket Scientist', 'Banana', 'Blimp', 'Hare']);
  const doubled = resolveRoll(rollTurn(state, state.racers[0].id, 3), 'rocket');
  assert.equal(doubled.racers[0].position, 6); assert.equal(doubled.racers[0].tripped, true);
  const returned = { ...doubled, currentPlayer: 0, currentRacerId: doubled.racers[0].id, phase: 'race' as GameState['phase'] };
  const recovered = takeTurn(returned, doubled.racers[0].id);
  assert.equal(recovered.racers[0].position, 6); assert.equal(recovered.racers[0].tripped, false);
});
