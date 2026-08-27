import assert from 'node:assert/strict';
import {
  RACERS,
  beginRace,
  createGame,
  resolveRoll,
  rollTurn,
  startRace,
  takeTurn,
  type GameState,
  type RacerName,
} from '../lib/game.ts';

const names = (value: RacerName[]) => Object.fromEntries(value.map((name, index) => [`player-${index + 1}`, [name]]));
const race = (value: RacerName[], board: GameState['board'] = 'Mild Mile') => {
  const state = startRace({ ...createGame('local', 'zh'), board }, names(value));
  return state;
};
const racer = (state: GameState, index = 0) => state.racers[index];

assert.equal(RACERS.length, 36, 'all 36 racer cards must be registered');

{
  const first = race(['Alchemist', 'Coach', 'Banana', 'Blimp']);
  assert.deepEqual(first.usedRacers, ['Alchemist', 'Coach', 'Banana', 'Blimp']);
  const next = beginRace({ ...first, raceNumber: 2 });
  assert.equal(next.usedRacers?.includes('Alchemist'), true, 'racers used in race one remain unavailable');
}

{
  const state = race(['Alchemist', 'Coach', 'Banana', 'Blimp']);
  state.racers[1].position = 1;
  const rolled = rollTurn(state, racer(state).id, 2);
  assert.equal(rolled.pendingRoll?.roll, 2);
  assert.equal(racer(rolled).position, 0, 'rolling must not move before resolution');
  const kept = resolveRoll(rolled, 'none');
  assert.equal(racer(kept).position, 2);
  const changed = resolveRoll(rollTurn(state, racer(state).id, 2), 'alchemist');
  assert.equal(racer(changed).position, 4, 'Alchemist can change 1/2 to 4');
}

{
  const state = race(['Rocket Scientist', 'Coach', 'Banana', 'Blimp']);
  state.racers[1].position = 1;
  const rolled = rollTurn(state, racer(state).id, 3);
  const doubled = resolveRoll(rolled, 'rocket');
  assert.equal(racer(doubled).position, 6);
  assert.equal(racer(doubled).tripped, true, 'Rocket Scientist trips after doubling');
  const afterTrip = takeTurn(doubled, racer(doubled).id);
  assert.equal(racer(afterTrip).tripped, false, 'tripped racer recovers automatically');
  assert.equal(racer(afterTrip).lastRoll, null, 'tripped turn has no main roll');
}

{
  const state = race(['Magician', 'Coach', 'Banana', 'Blimp']);
  state.racers[1].position = 1;
  const rolled = rollTurn(state, racer(state).id, 1);
  const rerolled = resolveRoll(rolled, 'magician', 6);
  assert.equal(rerolled.pendingRoll?.rerollsUsed, 1);
  assert.equal(racer(rerolled).position, 0, 'Magician reroll remains pending');
  const final = resolveRoll(rerolled, 'none');
  assert.equal(racer(final).position, 6);
}

{
  const state = race(['Banana', 'Coach', 'Blimp', 'Hare']);
  state.racers[0].position = 2;
  const next = takeTurn(state, state.racers[1].id, { forcedRoll: 4 });
  assert.equal(next.racers[1].position, 5);
  assert.equal(state.racers[1].tripped, false, 'input state is not mutated');
  assert.equal(next.racers[1].tripped, true, 'Banana trips a racer that passes the Banana');
}

{
  const state = race(['Stickler', 'Coach', 'Blimp', 'Hare']);
  state.racers[0].position = 28;
  const next = takeTurn(state, racer(state).id, { forcedRoll: 3 });
  assert.equal(racer(next).position, 30, 'Stickler itself may cross the finish');
  const other = { ...race(['Coach', 'Stickler', 'Blimp', 'Hare']) };
  other.racers[0].position = 28;
  const blocked = takeTurn(other, racer(other).id, { forcedRoll: 3 });
  assert.equal(racer(blocked).position, 28, 'other racers cannot overshoot a Stickler finish');
}

{
  const state = race(['M.O.U.T.H.', 'Coach', 'Blimp', 'Hare']);
  state.racers[1].position = 2;
  const next = takeTurn(state, racer(state).id, { forcedRoll: 2 });
  assert.equal(next.racers[1].eliminated, true, 'M.O.U.T.H. eliminates exactly one racer on stop');
}

{
  const state = race(['Gunk', 'Coach', 'Blimp', 'Hare']);
  state.racers[1].position = 1;
  const next = takeTurn(state, racer(state).id, { forcedRoll: 4 });
  assert.equal(racer(next).position, 4, 'Gunk does not reduce its own move');
  assert.equal(next.players.length, 4);
}

console.log('game rules smoke tests passed');
