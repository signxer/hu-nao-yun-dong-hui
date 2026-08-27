export type GameMode = 'ai' | 'local' | 'online';
export type Locale = 'zh' | 'en';
export type BoardName = 'Mild Mile' | 'Wild Wilds';
export type RacerName =
  | 'Alchemist' | 'Baba Yaga' | 'Banana' | 'Blimp' | 'Cheerleader' | 'Centaur'
  | 'Coach' | 'Copy Cat' | 'Dicemonger' | 'Duelist' | 'Egg' | 'Flip Flop'
  | 'Genius' | 'Gunk' | 'Hare' | 'Heckler' | 'Huge Baby' | 'Hypnotist'
  | 'Inchworm' | 'Lackey' | 'Leaptoad' | 'Legs' | 'Lovable Loser' | 'M.O.U.T.H.'
  | 'Magician' | 'Mastermind' | 'Party Animal' | 'Rocket Scientist' | 'Romantic'
  | 'Scoocher' | 'Sisyphus' | 'Skipper' | 'Stickler' | 'Suckerfish' | 'Third Wheel'
  | 'Twin';

export type AbilityActionId =
  | 'alchemist' | 'legs' | 'flip-flop' | 'hypnotist' | 'third-wheel' | 'cheerleader'
  | 'duelist' | 'rocket' | 'magician' | 'genius' | 'sisyphus' | 'party-animal' | 'copy-cat';
export type TurnChoice = 'none' | 'legs' | 'alchemist' | 'rocket' | 'magician' | 'sisyphus';
export interface RacerCard { name: RacerName; zhName: string; tagline: string; ability: string; zhAbility: string; color: string; token: number; speed: number; }
export interface RacerState {
  id: string; name: RacerName; ownerId: string; position: number; score: number; tripped: boolean;
  eliminated: boolean; finished: number | null; lastRoll: number | null; chips?: number; power?: RacerName; copyTargetId?: string;
}
export interface PlayerState { id: string; name: string; color: string; isAi?: boolean; team: RacerName[]; score: number; }
export interface PendingRoll { racerId: string; roll: number; rerollsUsed: number; start: number; }
export interface DecisionPrompt { id: string; kind: 'mastermind' | 'egg' | 'twin'; racerId: string; choices: string[]; }
export interface GameState {
  mode: GameMode; locale: Locale; phase: 'home' | 'draft' | 'race-select' | 'race' | 'result' | 'game-over' | 'room';
  board: BoardName; raceNumber: number; players: PlayerState[]; racers: RacerState[]; currentPlayer: number;
  currentRacerId?: string | null; finishers: string[]; raceSelections: Record<string, RacerName[]>;
  usedRacers?: RacerName[];
  lastMovePath?: number[];
  raceSelectPlayer: number; mastermindPrediction: { mastermindId: string; targetId: string } | null;
  log: string[]; roomCode?: string; connected?: number; pendingRoll?: PendingRoll | null;
  pendingDecision?: DecisionPrompt | null; rngState?: number; turnCount?: number;
  previousWinners?: RacerName[];
}

const colors = ['#f20f2b', '#1a76ff', '#9c42ff', '#18a85b', '#ff9f0b', '#ef3c9b'];
const zhNames: Record<RacerName, string> = {
  Alchemist: '炼金术士', 'Baba Yaga': '巴巴雅嘎', Banana: '香蕉', Blimp: '飞艇', Cheerleader: '啦啦队长', Centaur: '半人马', Coach: '教练', 'Copy Cat': '复刻猫', Dicemonger: '骰术师', Duelist: '决斗者', Egg: '鸡蛋', 'Flip Flop': '翻转', Genius: '天才', Gunk: '黏液', Hare: '兔子', Heckler: '嘲讽者', 'Huge Baby': '巨婴', Hypnotist: '催眠师', Inchworm: '尺蠖', Lackey: '跟班', Leaptoad: '跳蛙', Legs: '大长腿', 'Lovable Loser': '可爱输家', 'M.O.U.T.H.': '大嘴', Magician: '魔术师', Mastermind: '阴谋家', 'Party Animal': '派对动物', 'Rocket Scientist': '火箭科学家', Romantic: '浪漫者', Scoocher: '滑行者', Sisyphus: '西西弗斯', Skipper: '舵手', Stickler: '较真者', Suckerfish: '吸盘鱼', 'Third Wheel': '电灯泡', Twin: '双胞胎'
};

const rawRacers: Array<[RacerName, string, string, string, number]> = [
  ['Alchemist', 'Forever seeking the ancient secret of turning This into That.', 'When I roll a 1 or 2 for my main move, I can move 4 instead.', '主移动掷出 1 或 2 时，可以选择改为移动 4 格。', 4.7],
  ['Blimp', 'Built to fly, born to explode.', 'Before the second corner I get +3 to my main move; on or after it I get -1.', '在第二个弯道前开始回合时，主移动 +3；在该弯道或之后开始回合时，主移动 -1。', 5.7],
  ['Coach', 'Believing in yourself is even more important when you are some kind of lizard.', 'Everyone on my space gets +1 to their main move, including me.', '与我同格的所有角色（包括我）主移动 +1。', 5.1],
  ['Baba Yaga', 'This property is going fast.', 'Trip any racer that stops on my space, or when I stop on theirs.', '任何角色停在我所在的格子，或我停在其他角色所在格子时，让该角色绊倒。', 4.0],
  ['Centaur', 'Here’s the kicker.', 'A racer cannot be hoofwhacked farther back than Start.', '角色不能因踢回效果被踢到起点之后。', 4.1],
  ['Copy Cat', 'Very similar to another, different cat.', 'I have the power of the racer currently in the lead. If tied, I pick.', '我拥有当前领先角色的能力；若领先并列，由我选择复制谁。', 6.0],
  ['Banana', 'No more edible than you or I.', 'I trip any racer that passes me.', '任何经过我的角色都会绊倒。', 4.1],
  ['Cheerleader', 'A being of pure pep.', 'At the start of my turn, I can make racers in last place move 2; if I do, I move 1.', '回合开始时，可以让最后一名角色移动 2 格；如果这样做，自己再移动 1 格。', 6.0],
  ['Dicemonger', 'He picked his career from a d100 table.', 'Anyone can reroll their main move once per turn. When another racer rerolls, I move 1.', '每个角色每回合可以重掷一次主移动；其他角色重掷时，我先移动 1 格。', 7.1],
  ['Duelist', 'When you have a rapier, everything looks like a duel.', 'Whenever a racer shares my space, I can duel. The winner moves 2; I win ties.', '任何角色与我同格时，可以决斗；胜者移动 2 格，平局算我赢。', 6.2],
  ['Genius', 'And yet a fool in the ways of love.', 'I can predict my main roll. If right, I take an extra turn.', '可以预测主移动点数；预测正确时，额外获得一个回合。', 3.9],
  ['Heckler', 'It’s constructive criticism.', 'When a racer ends their turn within 1 space of where they started, I move 2.', '当角色结束回合时与起点相距不超过 1 格，我移动 2 格；绊倒恢复也适用。', 7.2],
  ['Egg', 'You should see the chicken.', 'Before my race, draw 3 racers and pick one. I have its powers.', '比赛开始前抽 3 名角色，选择其中 1 名并拥有其能力，但仍使用鸡蛋棋子。', 6.6],
  ['Gunk', 'A bit of a hugger.', 'Other racers get -1 to their main move.', '其他角色主移动 -1；这是减少移动距离，不是改变骰子点数。', 4.0],
  ['Huge Baby', 'She’s 30.', 'No one can share my space except at Start; put them behind me instead.', '除了起点外不能与我同格；本应同格时，把对方放到我身后一格。', 4.1],
  ['Flip Flop', 'Ever searching for its lost twin.', 'I can skip my main roll and swap spaces with another racer.', '可以跳过主移动掷骰，改为与另一名角色同时交换格子。', 10.6],
  ['Hare', 'The only thing he can’t outrun is hubris.', 'I get +2; if I start alone in the lead, I skip my main move.', '主移动 +2；如果回合开始时独自领先，则跳过主移动。', 6.3],
  ['Hypnotist', 'Implanted this false bio himself.', 'At the start of my turn, I can warp a racer to my space.', '回合开始时，可以将一名角色传送到自己所在格。', 4.2],
  ['Inchworm', 'Give her an inch and she’ll take an inch.', 'When another racer rolls 1, they skip that move and I move 1.', '其他角色主移动掷出 1 时，该角色跳过移动，我移动 1 格。', 4.7],
  ['Legs', 'Has arms, too, but who cares.', 'I can skip rolling and move 5 instead; it still counts as a main move.', '可以跳过掷骰并移动 5 格；这仍算主移动。', 2.0],
  ['Mastermind', 'The one scheme he can’t pull off is getting his parents back together.', 'At the start of my first turn, predict the winner; if right, I finish 2nd.', '第一个回合开始时预测获胜者；预测正确时比赛立即结束，阴谋家获得第 2 名。', 4.0],
  ['Lackey', 'If you’re happy, he’s happy.', 'When another racer rolls a 6, I move 2 before they move.', '其他角色主移动掷出 6 时，我先移动 2 格。', 5.8],
  ['Lovable Loser', 'Top of her class at Loser Academy.', 'At the start of my turn, gain 1 chip if I am alone in last place.', '回合开始时，如果我独自在最后一名，获得 1 个分数筹码。', 3.8],
  ['M.O.U.T.H.', 'Mastication Orifice Utilized Toward Hunger.', 'When I stop with exactly one other racer, eliminate them.', '停在恰好有另一名角色的格子时，将对方淘汰。', 4.0],
  ['Leaptoad', 'Frequently seen from below.', 'I skip spaces occupied by other racers.', '移动时跳过有其他角色的格子，向后移动也一样。', 5.3],
  ['Magician', 'He can also cast fireball.', 'I can reroll my main move up to two times and must use the last roll.', '主移动最多可以重掷两次，必须使用最后一次点数。', 4.8],
  ['Party Animal', 'They put a hat on an animal and this happened.', 'At my turn start everyone moves 1 toward me; each racer on my space gives me +1.', '回合开始时所有角色向我移动 1 格；与我同格的每名其他角色让我的主移动 +1。', 5.1],
  ['Rocket Scientist', 'Moonlights as a brain surgeon.', 'After rolling, I can double my main move; when I do, I trip.', '掷骰后可以将主移动翻倍；这样做后会绊倒。', 6.9],
  ['Sisyphus', 'Stays humble, keeps grinding.', 'Before my race take 4 chips; on a 6 I can warp to Start and lose 1 chip.', '比赛开始前获得 4 个分数筹码；主移动掷出 6 时，可以传送回起点并失去 1 个筹码。', 4.8],
  ['Suckerfish', 'Has abandonment issues.', 'When a racer starts a move on my space, I can move with them.', '当角色从我所在格开始移动时，可以跟随其一起移动；被跟随者先结算。', 8.3],
  ['Romantic', 'The last of her species.', 'When anyone stops with exactly one other racer, I move 2.', '任何角色停在恰好有另一名角色的格子时，我移动 2 格。', 9.7],
  ['Skipper', 'The wheel is fake; he just goes forward like everyone else.', 'When anyone rolls 1, I go next in turn order.', '任何角色主移动掷出 1 时，我成为回合顺序中的下一位。', 3.8],
  ['Third Wheel', 'Searching for her throther half.', 'At turn start I can warp to a space with exactly 2 racers, then still take my main move.', '回合开始时，可以传送到恰好有 2 名角色的格子，传送后仍进行主移动。', 5.0],
  ['Scoocher', 'Ope, just gonna scooch by you there.', 'When another racer’s power happens, I move 1.', '当另一名角色的能力发生时，我移动 1 格；特定能力按触发次数分别计算。', 10.7],
  ['Stickler', 'Proofread this rulebook without asking.', 'Other racers may cross the finish only by moving the exact amount needed.', '其他角色只有移动恰好到达终点时才能冲线，超出则不移动。', 4.1],
  ['Twin', 'Not related to anyone, just identical to everyone.', 'Before my race, pick a racer who won a previous race and use their power.', '比赛开始前选择上一场获胜角色并使用其能力，但仍使用双胞胎棋子。', 7.8],
];

export const RACERS: RacerCard[] = rawRacers.map(([name, tagline, ability, zhAbility, speed], i) => ({ name, zhName: zhNames[name], tagline, ability, zhAbility, speed, color: colors[i % colors.length], token: i }));
export const racerByName = (name: RacerName) => RACERS.find((r) => r.name === name)!;
export const wildEffects: Record<number, string> = { 1: 'star', 5: 'trip', 7: '+3', 11: '+1', 13: 'star', 16: '-4', 17: 'trip', 23: '+2', 24: '-2', 26: 'trip' };
export const displayRacerName = (name: RacerName, locale: Locale) => locale === 'zh' ? racerByName(name).zhName : name;
export const displayBoardName = (board: BoardName, locale: Locale) => locale === 'zh' ? (board === 'Mild Mile' ? '温和大道' : '荒野狂奔') : board;

const clone = <T,>(value: T): T => structuredClone(value);
const logLines = (state: GameState, lines: string[]) => [...state.log, ...lines].slice(-18);
const activeRacers = (state: GameState) => state.racers.filter((r) => !r.eliminated && r.finished === null);
const activeAt = (state: GameState, position: number, except?: string) => activeRacers(state).filter((r) => r.position === position && r.id !== except);
const nextRandom = (state: GameState, sides = 6) => { const current = state.rngState ?? 0x9e3779b9; const next = (Math.imul(current, 1664525) + 1013904223) >>> 0; state.rngState = next; return (next % sides) + 1; };
const racerPower = (state: GameState, racer: RacerState): RacerName => {
  if (racer.power) return racer.power;
  if (racer.name !== 'Copy Cat') return racer.name;
  const lead = Math.max(...activeRacers(state).map((item) => item.position));
  const candidates = activeRacers(state).filter((item) => item.position === lead && item.id !== racer.id); const selected = racer.copyTargetId ? candidates.find((item) => item.id === racer.copyTargetId) : undefined;
  if (selected) return selected.power ?? selected.name;
  return candidates[0]?.power ?? candidates[0]?.name ?? 'Copy Cat';
};
const hasPower = (state: GameState, name: RacerName, except?: string) => activeRacers(state).some((racer) => racerPower(state, racer) === name && racer.id !== except);
const orderIndex = (state: GameState, racer: RacerState) => state.racers.indexOf(racer);

export function createPlayers(mode: GameMode, count = 4): PlayerState[] { return Array.from({ length: count }, (_, i) => ({ id: `player-${i + 1}`, name: mode === 'ai' && i > 0 ? `电脑 ${i}` : `玩家 ${String.fromCharCode(65 + i)}`, color: colors[i], isAi: mode === 'ai' && i > 0, team: [], score: 0 })); }
export function makeRoomCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
export function createGame(mode: GameMode, locale: Locale): GameState { return { mode, locale, phase: mode === 'online' ? 'room' : 'draft', board: 'Mild Mile', raceNumber: 1, players: createPlayers(mode), racers: [], currentPlayer: 0, currentRacerId: null, finishers: [], raceSelections: {}, usedRacers: [], raceSelectPlayer: 0, mastermindPrediction: null, log: [], roomCode: mode === 'online' ? makeRoomCode() : undefined, connected: mode === 'online' ? 1 : undefined, pendingRoll: null, pendingDecision: null, rngState: 0x1234abcd, turnCount: 0, previousWinners: [] }; }
export function chooseTeam(state: GameState, playerId: string, names: RacerName[]) { const next = clone(state); const p = next.players.find((player) => player.id === playerId); if (p) p.team = names; return next; }
export function raceSlots(playerCount: number) { return playerCount <= 3 ? 2 : 1; }
export function beginRace(state: GameState): GameState { return { ...clone(state), phase: 'race-select', racers: [], finishers: [], currentPlayer: 0, currentRacerId: null, raceSelections: {}, raceSelectPlayer: 0, mastermindPrediction: null, pendingRoll: null, pendingDecision: null, board: state.raceNumber % 2 ? 'Mild Mile' : 'Wild Wilds', log: [...state.log, `第 ${state.raceNumber} 场 · ${state.raceNumber % 2 ? '温和大道' : '荒野狂奔'}`, '所有玩家选择本场出战角色。'].slice(-18) }; }

function beforeRacePower(state: GameState, racer: RacerState): RacerState { const next = { ...racer }; if (racer.name === 'Sisyphus') next.chips = 4; return next; }

export function startRace(state: GameState, selections: Record<string, RacerName[]>): GameState {
  const next = clone(state); const slots = raceSlots(next.players.length);
  next.usedRacers = [...new Set([...(next.usedRacers ?? []), ...Object.values(selections).flat()])];
  next.racers = next.players.flatMap((player) => (selections[player.id] ?? player.team.slice(0, slots)).slice(0, slots).map((name, index) => beforeRacePower(next, { id: `${player.id}-${index}`, name, ownerId: player.id, position: 0, score: 0, tripped: false, eliminated: false, finished: null, lastRoll: null })));
  next.phase = 'race'; next.raceSelections = selections; next.finishers = []; next.currentPlayer = 0; next.currentRacerId = next.racers[0]?.id ?? null; next.pendingRoll = null; next.pendingDecision = null;
  const mastermind = next.racers.find((r) => racerPower(next, r) === 'Mastermind'); const special = next.racers.find((r) => r.name === 'Egg' || (r.name === 'Twin' && (next.previousWinners?.length ?? 0) > 0)); next.log = logLines(next, ['角色已揭示，开始第一个回合。']); if (mastermind) next.log = logLines(next, ['阴谋家将在第一个回合开始时进行预言。']);
  if (special) { const choices = special.name === 'Egg' ? RACERS.filter((card) => !next.racers.some((racer) => racer.name === card.name)).slice(0, 3).map((card) => card.name) : (next.previousWinners ?? []); next.pendingDecision = choices.length ? { id: `before-race-${special.id}`, kind: special.name === 'Egg' ? 'egg' : 'twin', racerId: special.id, choices } : null; }
  return next;
}

export function resolveDecision(input: GameState, choice: RacerName): GameState {
  const state = clone(input); const prompt = state.pendingDecision; if (!prompt || !prompt.choices.includes(choice)) return state; const racer = state.racers.find((item) => item.id === prompt.racerId); if (!racer) return state;
  racer.power = choice; state.pendingDecision = null; state.log = logLines(state, [`${racerByName(racer.name).zhName} 选择获得 ${racerByName(choice).zhName} 的能力。`]);
  const nextSpecial = state.racers.find((item) => !item.power && (item.name === 'Egg' || (item.name === 'Twin' && (state.previousWinners?.length ?? 0) > 0)));
  if (nextSpecial) { const choices = nextSpecial.name === 'Egg' ? RACERS.filter((card) => !state.racers.some((item) => item.name === card.name)).slice(0, 3).map((card) => card.name) : (state.previousWinners ?? []); state.pendingDecision = choices.length ? { id: `before-race-${nextSpecial.id}`, kind: nextSpecial.name === 'Egg' ? 'egg' : 'twin', racerId: nextSpecial.id, choices } : null; }
  return state;
}

function currentRacer(state: GameState, racerId?: string) { if (racerId) return state.racers.find((r) => r.id === racerId && !r.eliminated && r.finished === null); const remembered = state.currentRacerId ? state.racers.find((r) => r.id === state.currentRacerId && !r.eliminated && r.finished === null) : undefined; if (remembered) return remembered; const owner = state.players[state.currentPlayer]?.id; return state.racers.find((r) => r.ownerId === owner && !r.eliminated && r.finished === null); }
function nextTurn(state: GameState, racer: RacerState, forcePlayer?: number) {
  const live = activeRacers(state); if (live.length <= 1 || state.finishers.length >= 2) return { ...state, phase: 'result' as const, currentRacerId: null };
  const start = forcePlayer === undefined ? state.currentPlayer : (forcePlayer + state.players.length) % state.players.length;
  for (let offset = 1; offset <= state.players.length; offset += 1) { const playerIndex = (start + offset) % state.players.length; const candidate = live.find((item) => item.ownerId === state.players[playerIndex].id); if (candidate) return { ...state, currentPlayer: playerIndex, currentRacerId: candidate.id }; }
  return { ...state, currentRacerId: racer.id };
}
function applyTrip(state: GameState, racer: RacerState, lines: string[]) { racer.tripped = true; lines.push(`${racerByName(racer.name).zhName} 被绊倒，下一次主移动跳过。`); }

function finishRacer(state: GameState, racer: RacerState, lines: string[]) {
  if (racer.position < 30 || racer.finished !== null || racer.eliminated) return;
  racer.finished = state.finishers.length + 1; state.finishers.push(racer.id); const points = racer.finished === 1 ? 4 : racer.finished === 2 ? 2 : 0; const owner = state.players.find((player) => player.id === racer.ownerId); if (owner) owner.score += points + racer.score;
  lines.push(`${racerByName(racer.name).zhName} 冲过终点，获得第 ${racer.finished} 名。`);
  const prediction = state.mastermindPrediction;
  if (prediction?.targetId === racer.id) { if (prediction.mastermindId === racer.id) { const p = state.players.find((item) => item.id === racer.ownerId); if (p) p.score += 2; state.finishers.push(racer.id); lines.push(`${racerByName(racer.name).zhName} 预测自己获胜，同时获得第 2 名分数。`); } else { const mastermind = state.racers.find((item) => item.id === prediction.mastermindId && !item.eliminated && item.finished === null); if (mastermind) { mastermind.finished = 2; state.finishers.push(mastermind.id); const p = state.players.find((item) => item.id === mastermind.ownerId); if (p) p.score += 2; lines.push(`${racerByName(mastermind.name).zhName} 的预言命中，获得第 2 名。`); } } }
}

function applyWildStop(state: GameState, racer: RacerState, lines: string[], trace?: number[]) {
  if (state.board !== 'Wild Wilds' || racer.position >= 30) return; const effect = wildEffects[racer.position]; if (!effect) return;
  if (effect === 'trip') applyTrip(state, racer, lines); if (effect === 'star') { const owner = state.players.find((player) => player.id === racer.ownerId); if (owner) owner.score += 1; lines.push(`${racerByName(racer.name).zhName} 获得 1 分星星。`); }
  if (effect.startsWith('+') || effect.startsWith('-')) {
    const delta = Number(effect);
    const direction = Math.sign(delta);
    const start = racer.position;
    for (let step = 1; step <= Math.abs(delta); step += 1) {
      const next = Math.max(0, Math.min(30, start + direction * step));
      if (next !== racer.position) trace?.push(next);
      racer.position = next;
    }
    lines.push(`${racerByName(racer.name).zhName} 触发箭头，移动 ${delta > 0 ? '+' : ''}${delta} 格。`);
  }
}

function moveDistance(state: GameState, racer: RacerState, distance: number, lines: string[], source: 'main' | 'power' | 'warp' | 'scooch' = 'power', depth = 0, trace?: number[]) {
  if (depth > 24 || racer.eliminated || racer.finished !== null || distance === 0) return;
  if (source === 'power') activeRacers(state).filter((item) => item.id !== racer.id && racerPower(state, item) === 'Scoocher').forEach((item) => moveDistance(state, item, 1, lines, 'scooch', depth + 1));
  const start = racer.position; const direction = Math.sign(distance); const requested = Math.abs(distance); const stickler = hasPower(state, 'Stickler', racer.id);
  if (direction > 0 && stickler && start + requested > 30) { lines.push(`${racerByName(racer.name).zhName} 受到较真者影响，移动会超过终点，本次不移动。`); return; }
  let steps = 0; let cursor = start;
  while (steps < requested && cursor < 30 && cursor > 0 || steps < requested && cursor < 30) {
    cursor += direction; if (cursor < 0) cursor = 0; const occupied = activeAt(state, cursor, racer.id).length > 0; if (!(racerPower(state, racer) === 'Leaptoad' && occupied)) { steps += 1; trace?.push(cursor); } if (cursor === 30 || cursor === 0) break; if (Math.abs(cursor - start) > 60) break;
  }
  const end = Math.max(0, Math.min(30, cursor)); const passed = activeRacers(state).filter((other) => other.id !== racer.id && (direction > 0 ? other.position > start && other.position < end : direction < 0 ? other.position < start && other.position > end : false)); racer.position = end;
  if (passed.length) lines.push(`${racerByName(racer.name).zhName} 经过 ${passed.map((item) => racerByName(item.name).zhName).join('、')}。`);
  if (passed.some((other) => activeRacers(state).some((item) => item.position === other.position && racerPower(state, item) === 'Banana'))) applyTrip(state, racer, lines);
  const hugeBaby = activeRacers(state).find((item) => item.id !== racer.id && item.position === racer.position && racerPower(state, item) === 'Huge Baby');
  if (hugeBaby && racer.position > 0) { racer.position = Math.max(0, racer.position - 1); trace?.push(racer.position); lines.push(`${racerByName(racer.name).zhName} 被巨婴推回 1 格。`); }
  if (racerPower(state, racer) === 'Huge Baby') activeAt(state, racer.position, racer.id).forEach((other) => { other.position = Math.max(0, racer.position - 1); lines.push(`${racerByName(other.name).zhName} 被巨婴推回 1 格。`); if (racerPower(state, other) === 'Banana') applyTrip(state, racer, lines); });
  applyWildStop(state, racer, lines, trace); finishRacer(state, racer, lines);
  const same = activeAt(state, racer.position, racer.id);
  if (racerPower(state, racer) === 'M.O.U.T.H.' && same.length === 1) { same[0].eliminated = true; lines.push(`${racerByName(same[0].name).zhName} 被大嘴淘汰。`); }
  if (same.length && racerPower(state, racer) === 'Baba Yaga') same.forEach((item) => applyTrip(state, item, lines));
  if (same.length && hasPower(state, 'Baba Yaga', racer.id)) applyTrip(state, racer, lines);
  if (same.length === 1 && hasPower(state, 'Romantic')) { const romantic = activeRacers(state).find((item) => racerPower(state, item) === 'Romantic'); if (romantic) { lines.push(`${racerByName(romantic.name).zhName} 触发浪漫者，移动 2 格。`); moveDistance(state, romantic, 2, lines, 'power', depth + 1); } }
  if (source === 'main' && same.length === 1 && hasPower(state, 'Duelist')) lines.push('决斗者发现同格目标，可以在此处宣布决斗。');
}

function mainDistance(state: GameState, racer: RacerState, roll: number) {
  let distance = roll; const power = racerPower(state, racer); const start = racer.position;
  if (power === 'Blimp') distance += start < 12 ? 3 : -1;
  if (power === 'Hare') { const lead = Math.max(...activeRacers(state).map((item) => item.position)); const alone = start === lead && activeRacers(state).filter((item) => item.position === lead).length === 1; distance = alone ? 0 : distance + 2; }
  const coaches = activeRacers(state).filter((item) => item.position === start && racerPower(state, item) === 'Coach').length; if (coaches) distance += coaches;
  if (power === 'Party Animal') distance += activeAt(state, start).length;
  const gunkCount = activeRacers(state).filter((item) => racerPower(state, item) === 'Gunk' && item.id !== racer.id).length; return Math.max(0, distance - gunkCount);
}

function resolveStartPowers(state: GameState, racer: RacerState, lines: string[]) {
  const power = racerPower(state, racer);
  if (power === 'Lovable Loser') { const last = Math.min(...activeRacers(state).map((item) => item.position)); if (racer.position === last && activeRacers(state).filter((item) => item.position === last).length === 1) { racer.chips = (racer.chips ?? 0) + 1; lines.push(`${racerByName(racer.name).zhName} 独自在最后一名，获得 1 个筹码。`); } }
  if (power === 'Party Animal') activeRacers(state).filter((item) => item.id !== racer.id).forEach((other) => { const direction = Math.sign(racer.position - other.position); if (direction) moveDistance(state, other, direction, lines, 'power'); });
}

function triggerEndPowers(state: GameState, racer: RacerState, start: number, lines: string[]) {
  const hecklers = activeRacers(state).filter((item) => item.id !== racer.id && racerPower(state, item) === 'Heckler');
  if (Math.abs(racer.position - start) <= 1) hecklers.forEach((heckler) => { lines.push(`${racerByName(heckler.name).zhName} 触发嘲讽者，移动 2 格。`); moveDistance(state, heckler, 2, lines, 'power'); });
}

function advanceAfterTurn(state: GameState, racer: RacerState, roll: number, lines: string[], repeat = false, start = racer.position) {
  triggerEndPowers(state, racer, start, lines);
  if (roll === 1) { const skipper = activeRacers(state).find((item) => racerPower(state, item) === 'Skipper'); if (skipper) { const ownerIndex = state.players.findIndex((item) => item.id === skipper.ownerId); return nextTurn(state, racer, ownerIndex - 1); } }
  if (racerPower(state, racer) === 'Genius' && repeat) return { ...state, currentPlayer: state.currentPlayer, currentRacerId: racer.id };
  return nextTurn(state, racer);
}

export function rollTurn(input: GameState, racerId?: string, forcedRoll?: number): GameState {
  const state = clone(input); if (state.phase !== 'race' || state.pendingRoll) return state; const racer = currentRacer(state, racerId); if (!racer) return state;
  if (racer.tripped) { const start = racer.position; racer.tripped = false; racer.lastRoll = null; const lines = [`${racerByName(racer.name).zhName} 绊倒恢复，本回合跳过主移动。`]; triggerEndPowers(state, racer, start, lines); state.log = logLines(state, lines); return nextTurn(state, racer); }
  resolveStartPowers(state, racer, state.log); const roll = forcedRoll ?? nextRandom(state); racer.lastRoll = roll; state.pendingRoll = { racerId: racer.id, roll, rerollsUsed: 0, start: racer.position }; state.log = logLines(state, [`${racerByName(racer.name).zhName} 掷出 ${roll}，等待移动结算。`]); return state;
}

export function resolveRoll(input: GameState, choice: TurnChoice = 'none', forcedReroll?: number, predicted?: number): GameState {
  const state = clone(input); const pending = state.pendingRoll; if (!pending) return state; const racer = state.racers.find((item) => item.id === pending.racerId); if (!racer) return state;
  if (choice === 'magician' && pending.rerollsUsed < 2) { const roll = forcedReroll ?? nextRandom(state); pending.roll = roll; pending.rerollsUsed += 1; racer.lastRoll = roll; state.log = logLines(state, [`${racerByName(racer.name).zhName} 使用魔术师重掷第 ${pending.rerollsUsed} 次，得到 ${roll}。`]); return state; }
  const lines: string[] = []; const roll = pending.roll; const movementPath: number[] = [racer.position]; state.lastMovePath = undefined; let distance = choice === 'legs' ? mainDistance(state, racer, 5) : mainDistance(state, racer, roll);
  if (choice === 'legs') { racer.lastRoll = null; lines.push(`${racerByName(racer.name).zhName} 使用大长腿，跳过掷骰并进行 5 格主移动。`); }
  if (choice === 'alchemist' && roll <= 2) distance = mainDistance(state, racer, 4);
  if (choice === 'rocket') { distance = mainDistance(state, racer, roll * 2); applyTrip(state, racer, lines); lines.push(`${racerByName(racer.name).zhName} 将主移动翻倍。`); }
  const othersBefore = activeRacers(state).filter((item) => item.id !== racer.id).sort((a, b) => orderIndex(state, a) - orderIndex(state, b));
  if (roll === 6) { const lackey = othersBefore.filter((item) => racerPower(state, item) === 'Lackey'); lackey.forEach((item) => moveDistance(state, item, 2, lines, 'power')); }
  if (choice === 'sisyphus' && roll === 6 && (racer.chips ?? 0) > 0) { racer.chips = (racer.chips ?? 0) - 1; racer.position = 0; lines.push(`${racerByName(racer.name).zhName} 使用西西弗斯，传送回起点并失去 1 个筹码。`); } else {
    const inchworm = activeRacers(state).find((item) => item.id !== racer.id && racerPower(state, item) === 'Inchworm');
    if (roll === 1 && inchworm) { lines.push(`${racerByName(racer.name).zhName} 掷出 1，被尺蠖截断主移动。`); moveDistance(state, inchworm, 1, lines, 'power'); }
    else {
      const followers = activeRacers(state).filter((item) => item.id !== racer.id && racerPower(state, item) === 'Suckerfish' && item.position === pending.start);
      followers.forEach((follower) => moveDistance(state, follower, distance, lines, 'power'));
      moveDistance(state, racer, distance, lines, 'main', 0, movementPath);
    }
  }
  if (choice === 'sisyphus' && roll === 6 && (racer.chips ?? 0) >= 0 && racer.position === 0 && movementPath[movementPath.length - 1] !== 0) movementPath.push(0);
  const others = activeRacers(state).filter((item) => item.id !== racer.id).sort((a, b) => orderIndex(state, a) - orderIndex(state, b));
  if (choice === 'magician') {
    const diceMonger = others.find((item) => racerPower(state, item) === 'Dicemonger'); if (diceMonger) moveDistance(state, diceMonger, 1, lines, 'power');
    const scoochers = others.filter((item) => racerPower(state, item) === 'Scoocher'); scoochers.forEach((item) => moveDistance(state, item, 1, lines, 'power'));
  }
  const repeat = predicted !== undefined && predicted === roll && racerPower(state, racer) === 'Genius'; if (repeat) lines.push(`${racerByName(racer.name).zhName} 预测正确，获得额外回合。`);
  if (movementPath.length > 1) state.lastMovePath = movementPath;
  state.pendingRoll = null; state.turnCount = (state.turnCount ?? 0) + 1; state.log = logLines(state, lines); return advanceAfterTurn(state, racer, roll, state.log, repeat, pending.start);
}

export function takeTurn(input: GameState, racerId?: string, options?: { ability?: AbilityActionId; prediction?: number; rerollFrom?: number; forcedRoll?: number }): GameState {
  const state = rollTurn(input, racerId, options?.forcedRoll); if (!state.pendingRoll) return state;
  const choice: TurnChoice = options?.ability === 'legs' ? 'legs' : options?.ability === 'alchemist' ? 'alchemist' : options?.ability === 'rocket' ? 'rocket' : options?.ability === 'magician' ? 'magician' : options?.ability === 'sisyphus' ? 'sisyphus' : 'none';
  if (choice === 'magician') {
    let next = resolveRoll(state, choice, options?.rerollFrom, options?.prediction);
    while (next.pendingRoll && next.pendingRoll.rerollsUsed < 2) next = resolveRoll(next, 'magician', undefined, options?.prediction);
    return next.pendingRoll ? resolveRoll(next, 'none', undefined, options?.prediction) : next;
  }
  return resolveRoll(state, choice, undefined, options?.prediction);
}

export function abilityActions(state: GameState, racer: RacerState | undefined) {
  if (!racer || racer.eliminated || racer.finished !== null || racer.tripped) return [] as Array<{ id: AbilityActionId; targetIds: string[] }>;
  const active = activeRacers(state).filter((other) => other.id !== racer.id); const same = active.filter((other) => other.position === racer.position); const crowded = active.filter((other) => active.filter((candidate) => candidate.position === other.position).length === 2); const power = racerPower(state, racer);
  const actions: Array<{ id: AbilityActionId; targetIds: string[] }> = [];
  if (power === 'Alchemist' && state.pendingRoll?.racerId === racer.id && state.pendingRoll.roll <= 2) actions.push({ id: 'alchemist', targetIds: [] }); if (power === 'Legs' && !state.pendingRoll) actions.push({ id: 'legs', targetIds: [] }); if (power === 'Rocket Scientist' && state.pendingRoll?.racerId === racer.id) actions.push({ id: 'rocket', targetIds: [] }); if (power === 'Magician' && state.pendingRoll?.racerId === racer.id && state.pendingRoll.rerollsUsed < 2) actions.push({ id: 'magician', targetIds: [] }); if (power === 'Genius' && !state.pendingRoll) actions.push({ id: 'genius', targetIds: [] }); if (power === 'Sisyphus' && state.pendingRoll?.racerId === racer.id && state.pendingRoll.roll === 6 && (racer.chips ?? 0) > 0) actions.push({ id: 'sisyphus', targetIds: [] });
  if (!state.pendingRoll) { if (power === 'Copy Cat') { const lead = Math.max(...activeRacers(state).map((item) => item.position)); const leaders = active.filter((item) => item.position === lead); if (leaders.length > 1) actions.push({ id: 'copy-cat', targetIds: leaders.map((item) => item.id) }); } if (power === 'Flip Flop' && active.length) actions.push({ id: 'flip-flop', targetIds: active.map((other) => other.id) }); if (power === 'Hypnotist' && active.length) actions.push({ id: 'hypnotist', targetIds: active.map((other) => other.id) }); if (power === 'Third Wheel' && crowded.length) actions.push({ id: 'third-wheel', targetIds: crowded.map((other) => other.id) }); if (power === 'Cheerleader' && active.length) actions.push({ id: 'cheerleader', targetIds: [] }); if (power === 'Party Animal') actions.push({ id: 'party-animal', targetIds: [] }); if (power === 'Duelist' && same.length) actions.push({ id: 'duelist', targetIds: same.map((other) => other.id) }); }
  return actions;
}

export function activateAbility(input: GameState, racerId: string, action: AbilityActionId, targetId?: string): GameState {
  const state = clone(input); const racer = state.racers.find((item) => item.id === racerId); if (!racer) return state; const target = state.racers.find((item) => item.id === targetId); const lines: string[] = []; const power = racerPower(state, racer);
  if (action === 'copy-cat' && target) { racer.copyTargetId = target.id; lines.push(`${racerByName(racer.name).zhName} 选择复制 ${racerByName(target.name).zhName} 的能力。`); }
  if (action === 'flip-flop' && target) { const old = racer.position; racer.position = target.position; target.position = old; lines.push(`${racerByName(racer.name).zhName} 使用翻转，与 ${racerByName(target.name).zhName} 同时交换格子。`); }
  if (action === 'hypnotist' && target) { target.position = racer.position; lines.push(`${racerByName(racer.name).zhName} 催眠 ${racerByName(target.name).zhName}，传送到自己所在格。`); }
  if (action === 'third-wheel' && target) { racer.position = target.position; lines.push(`${racerByName(racer.name).zhName} 使用电灯泡，传送到双人格。`); }
  if (action === 'cheerleader') { const last = Math.min(...activeRacers(state).map((item) => item.position)); activeRacers(state).filter((item) => item.position === last && item.id !== racer.id).forEach((item) => moveDistance(state, item, 2, lines, 'power')); moveDistance(state, racer, 1, lines, 'power'); }
  if (action === 'party-animal') resolveStartPowers(state, racer, lines);
  if (action === 'duelist' && target) { const ownRoll = nextRandom(state); const targetRoll = nextRandom(state); const winner = ownRoll >= targetRoll ? racer : target; lines.push(`决斗：${racerByName(racer.name).zhName} ${ownRoll}，${racerByName(target.name).zhName} ${targetRoll}；${racerByName(winner.name).zhName} 移动 2 格。`); moveDistance(state, winner, 2, lines, 'power'); }
  if (power === 'Copy Cat') lines.push(`${racerByName(racer.name).zhName} 复制了当前领先角色的能力。`);
  return { ...state, log: logLines(state, lines) };
}

export function nextRace(state: GameState): GameState {
  if (state.raceNumber >= 4) return { ...clone(state), phase: 'game-over' };
  const winner = state.racers.find((racer) => racer.id === state.finishers[0]);
  const next = { ...clone(state), raceNumber: state.raceNumber + 1, previousWinners: winner ? [winner.power ?? winner.name] : state.previousWinners };
  const selecting = beginRace(next);

  // By the final race, the snake draft has already used every other team card.
  // There is no meaningful choice left, so go directly to the race with the
  // remaining slot(s) instead of showing an empty/forced selection screen.
  if (selecting.raceNumber === 4) {
    const slots = raceSlots(selecting.players.length);
    const used = new Set(selecting.usedRacers ?? []);
    const selections = Object.fromEntries(selecting.players.map((player) => [
      player.id,
      player.team.filter((name) => !used.has(name)).slice(0, slots),
    ])) as Record<string, RacerName[]>;
    if (selecting.players.every((player) => (selections[player.id] ?? []).length === slots)) {
      return startRace(selecting, selections);
    }
  }
  return selecting;
}
