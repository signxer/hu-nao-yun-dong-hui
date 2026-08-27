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

export type AbilityActionId = 'legs' | 'flip-flop' | 'hypnotist' | 'third-wheel' | 'cheerleader' | 'duelist' | 'rocket' | 'magician' | 'genius';
export interface RacerCard { name: RacerName; zhName: string; tagline: string; ability: string; zhAbility: string; color: string; token: number; speed: number; }
export interface RacerState { id: string; name: RacerName; ownerId: string; position: number; score: number; tripped: boolean; eliminated: boolean; finished: number | null; lastRoll: number | null; }
export interface PlayerState { id: string; name: string; color: string; isAi?: boolean; team: RacerName[]; score: number; }
export interface GameState { mode: GameMode; locale: Locale; phase: 'home' | 'draft' | 'race' | 'result' | 'game-over' | 'room'; board: BoardName; raceNumber: number; players: PlayerState[]; racers: RacerState[]; currentPlayer: number; finishers: string[]; log: string[]; roomCode?: string; connected?: number; }

const colors = ['#f20f2b', '#1a76ff', '#9c42ff', '#18a85b', '#ff9f0b', '#ef3c9b'];
const zhNames: Record<RacerName, string> = {
  Alchemist: '炼金术士', 'Baba Yaga': '巴巴雅嘎', Banana: '香蕉', Blimp: '飞艇', Cheerleader: '啦啦队长', Centaur: '半人马', Coach: '教练', 'Copy Cat': '复刻猫', Dicemonger: '骰术师', Duelist: '决斗者', Egg: '鸡蛋', 'Flip Flop': '翻转', Genius: '天才', Gunk: '黏液', Hare: '兔子', Heckler: '嘲讽者', 'Huge Baby': '巨婴', Hypnotist: '催眠师', Inchworm: '尺蠖', Lackey: '跟班', Leaptoad: '跳蛙', Legs: '大长腿', 'Lovable Loser': '可爱输家', 'M.O.U.T.H.': '大嘴', Magician: '魔术师', Mastermind: '阴谋家', 'Party Animal': '派对动物', 'Rocket Scientist': '火箭科学家', Romantic: '浪漫者', Scoocher: '滑行者', Sisyphus: '西西弗斯', Skipper: '舵手', Stickler: '较真者', Suckerfish: '吸盘鱼', 'Third Wheel': '电灯泡', Twin: '双胞胎'
};

const rawRacers: Array<[RacerName, string, string, string, number]> = [
  ['Alchemist', 'Forever seeking the ancient secret of turning This into That.', 'When I roll a 1 or 2 for my main move, I can move 4 instead.', '主移动掷出 1 或 2 时，可以改为移动 4 格。', 4.7],
  ['Blimp', 'Built to fly, born to explode.', 'When I start my turn before the second corner of the track, I get +3 to my main move. On or after that corner, I get -1.', '在赛道第二个弯道前开始回合时，主移动 +3；在该弯道或之后开始回合时，主移动 -1。', 5.7],
  ['Coach', 'Believing in yourself is even more important when you are some kind of lizard.', 'Everyone on my space gets +1 to their main move, including me.', '与我同格的所有角色（包括我）主移动 +1。', 5.1],
  ['Baba Yaga', 'This property is going fast.', 'Trip any racer that stops on my space, or when I stop on theirs.', '任何角色停在我所在的格子，或我停在其他角色所在的格子时，让该角色 Trip。', 4.0],
  ['Centaur', 'Here’s the kicker.', 'A racer can’t be hoofwhacked any farther back than the Start space.', '角色不能因 Hoofwhack 被踢到 Start 之后。', 4.1],
  ['Copy Cat', 'Very similar to another, different cat.', 'I have the power of the racer currently in the lead. If there is a tie, I pick.', '我拥有当前领先角色的能力；若领先并列，由我选择复制谁。', 6.0],
  ['Banana', 'No more edible than you or I.', 'I trip any racer that passes me.', '任何经过我的角色都会 Trip。', 4.1],
  ['Cheerleader', 'A being of pure pep.', 'At the start of my turn, I can make the racers in last place move 2. If I do, I move 1.', '回合开始时，可以让最后一名的角色移动 2 格；如果这样做，我再移动 1 格。', 6.0],
  ['Dicemonger', 'He picked his career from a d100 table.', 'Anyone can reroll their main move once per turn. When another racer does it, I move 1.', '每个角色每回合可以重掷一次主移动。其他角色重掷时，我移动 1 格。', 7.1],
  ['Duelist', 'When you have a rapier, everything looks like a duel.', 'Whenever a racer shares my space, I can shout DUEL! We roll our dice and whoever rolls highest moves 2. I win ties.', '任何角色与我同格时，我可以宣布 DUEL！双方掷骰，点数较高者移动 2 格；平局算我赢。', 6.2],
  ['Genius', 'And yet a fool in the ways of love.', 'I can predict what number I will roll for my main move. If I am right, I take an extra turn.', '可以预测主移动会掷出几点；预测正确时，额外获得一个回合。', 3.9],
  ['Heckler', 'It’s constructive criticism.', 'When a racer ends their turn within 1 space of where they started, I move 2.', '当角色结束回合时与起点相距不超过 1 格，我移动 2 格；该能力对正在恢复 Trip 的角色也有效。', 7.2],
  ['Egg', 'You should see the chicken. You should still use my racer token! I still get any before-race powers.', 'Before my race, draw 3 new racers from the deck and pick one. I have its powers.', '比赛开始前，从牌库抽 3 名新角色，选择其中 1 名；我拥有所选角色的能力，但仍使用我的棋子。', 6.6],
  ['Gunk', 'A bit of a hugger.', 'Other racers get -1 to their main move.', '其他角色的主移动 -1；这是减少移动距离，不是改变骰子点数。', 4.0],
  ['Huge Baby', 'She’s 30.', 'No one can ever be on my space, besides the Start. Whenever that would happen, put the racer on the space behind me instead. If I stop on Banana’s space and move them back, it counts as passing them and I trip.', '除了 Start 外，不能有角色与我同格。若本应同格，把对方放到我身后一格；如果我停在 Banana 所在格并将 Banana 推回，这算经过 Banana，我会 Trip。', 4.1],
  ['Flip Flop', 'Ever searching for its lost twin.', 'I can skip rolling for my main move and swap spaces with another racer instead. We flop flip simultaneously.', '可以跳过主移动掷骰，改为与另一名角色交换格子；双方同时完成 Flip Flop。', 10.6],
  ['Hare', 'The only thing he can’t outrun is hubris.', 'I get +2 to my main move. When I start my turn alone in the lead, I skip my main move.', '主移动 +2；如果我在回合开始时独自领先，则跳过主移动。', 6.3],
  ['Hypnotist', 'Implanted this false bio himself.', 'At the start of my turn, I can warp a racer to my space.', '回合开始时，可以将一名角色 Warp 到我所在格。', 4.2],
  ['Inchworm', 'Give her an inch and she’ll take an inch.', 'When another racer rolls a 1 for their main move, they skip that move and I move 1.', '其他角色主移动掷出 1 时，该角色跳过这次移动，我移动 1 格。', 4.7],
  ['Legs', 'Has arms, too, but who cares.', 'I can skip rolling for my main move and move 5 instead.', '可以跳过主移动掷骰，改为移动 5 格；这仍算主移动。', 2.0],
  ['Mastermind', 'The one scheme he can’t pull off is getting his parents back together.', 'At the start of my first turn, I predict which racer will win. If I’m right, the race ends immediately and I finish 2nd.', '第一个回合开始时，预测哪名角色会获胜；预测正确时，比赛立即结束，我获得第 2 名。', 4.0],
  ['Lackey', 'If you’re happy, he’s happy.', 'I do my move before the other racer, if it matters.', '如果顺序重要，我在另一名角色之前完成移动。', 5.8],
  ['Lovable Loser', 'Top of her class at Loser Academy. Which is bad.', 'At the start of my turn, I get 1 point chip if I’m alone in last place.', '回合开始时，如果我独自在最后一名，获得 1 个分数筹码。', 3.8],
  ['M.O.U.T.H.', 'Mastication Orifice Utilized Toward Hunger.', 'When I stop on a space with exactly one other racer, they are eliminated from the race.', '当我停在恰好有另一名角色的格子时，将对方从比赛中淘汰。', 4.0],
  ['Leaptoad', 'Frequently seen from below. Yes, even if I’m moving backwards.', 'I skip spaces with other racers on them.', '我会跳过有其他角色的格子；即使向后移动也一样。', 5.3],
  ['Magician', 'He can also cast fireball.', 'I can reroll my main move up to two times. I must use whatever my last roll is.', '主移动最多可以重掷两次；必须使用最后一次掷出的点数。', 4.8],
  ['Party Animal', 'They put a hat on an animal and this happened.', 'At the start of my turn, all racers move 1 space towards me. Each other racer on my space gives me +1 to my main move.', '回合开始时，所有角色向我移动 1 格；与我同格的每名其他角色让我的主移动 +1。', 5.1],
  ['Rocket Scientist', 'Moonlights as a brain surgeon.', 'I can double my main move roll. When I do, I trip.', '可以将主移动骰子点数翻倍；这样做后我会 Trip。', 6.9],
  ['Sisyphus', 'Stays humble, keeps grinding.', 'Before my race, I take 4 point chips. When I roll a 6 for my main move, instead of moving, I warp to Start and lose 1 point chip.', '比赛开始前获得 4 个分数筹码。主移动掷出 6 时，可以不移动，Warp 回 Start 并失去 1 个分数筹码。', 4.8],
  ['Suckerfish', 'Has abandonment issues.', 'When a racer starts a move on my space, I can move with them. I arrive at the same time, but for finishing and triggering powers, the racer I’m moving with resolves first.', '当角色从我所在格开始移动时，可以跟随其一起移动；同时到达，但在冲线和触发能力时，被跟随的角色先结算。', 8.3],
  ['Romantic', 'The last of her species.', 'When anyone stops on a space with exactly one other racer, I move 2.', '当任何角色停在恰好有另一名角色的格子时，我移动 2 格。', 9.7],
  ['Skipper', 'The wheel is fake; he just goes forward like everyone else.', 'When anyone rolls a 1 for their main move, I go next in turn order.', '任何角色主移动掷出 1 时，我在回合顺序中下一位行动。', 3.8],
  ['Third Wheel', 'Searching for her throther half.', 'At the start of my turn, I can warp to any space with exactly 2 racers on it. I still get my main move after warping.', '回合开始时，可以 Warp 到恰好有 2 名角色的任意格；Warp 后仍然进行主移动。', 5.0],
  ['Scoocher', 'Ope, just gonna scooch by you there.', 'When another racer’s power happens, I move 1.', '当另一名角色的能力发生时，我移动 1 格；Gunk、Dicemonger、Leaptoad 和 Magician 的相关触发按规则分别计数。', 10.7],
  ['Stickler', 'Proofread this rulebook without asking.', 'Other racers can only cross the finish line by moving the exact amount they need. If they overshoot, they don’t move.', '其他角色只有在移动恰好到达终点时才能冲线；如果会超过终点，则不移动。', 4.1],
  ['Twin', 'Not related to anyone, just identical to everyone. You should still use my racer token! I still get any before-race powers.', 'Before my race, I can pick a racer who won a previous race and race with their powers.', '比赛开始前，可以选择上一场获胜的角色，并使用其能力；仍使用我的棋子。', 7.8],
];

export const RACERS: RacerCard[] = rawRacers.map(([name, tagline, ability, zhAbility, speed], i) => ({ name, zhName: zhNames[name], tagline, ability, zhAbility, speed, color: colors[i % colors.length], token: i }));
export const racerByName = (name: RacerName) => RACERS.find((r) => r.name === name)!;
export const wildEffects: Record<number, string> = { 1: 'star', 5: 'trip', 7: '+3', 11: '+1', 13: 'star', 16: '-4', 17: 'trip', 23: '+2', 24: '-2', 26: 'trip' };
export const displayRacerName = (name: RacerName, locale: Locale) => locale === 'zh' ? racerByName(name).zhName : name;
export const displayBoardName = (board: BoardName, locale: Locale) => locale === 'zh' ? (board === 'Mild Mile' ? '温和大道' : '荒野狂奔') : board;

export function createPlayers(mode: GameMode, count = 4): PlayerState[] { return Array.from({ length: count }, (_, i) => ({ id: `player-${i + 1}`, name: mode === 'ai' && i > 0 ? `AI ${i}` : `玩家 ${String.fromCharCode(65 + i)}`, color: colors[i], isAi: mode === 'ai' && i > 0, team: [], score: 0 })); }
export function makeRoomCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
export function createGame(mode: GameMode, locale: Locale): GameState { return { mode, locale, phase: mode === 'online' ? 'room' : 'draft', board: 'Mild Mile', raceNumber: 1, players: createPlayers(mode), racers: [], currentPlayer: 0, finishers: [], log: [], roomCode: mode === 'online' ? makeRoomCode() : undefined, connected: mode === 'online' ? 1 : undefined }; }
export function chooseTeam(state: GameState, playerId: string, names: RacerName[]) { const p = state.players.find((player) => player.id === playerId); if (p) p.team = names; }
export function beginRace(state: GameState): GameState { const racers = state.players.flatMap((p) => { const picks = p.team.length ? p.team.slice(0, state.players.length === 2 ? 2 : 1) : [RACERS[Math.floor(Math.random() * RACERS.length)].name]; return picks.map((name, i) => ({ id: `${p.id}-${i}`, name, ownerId: p.id, position: 0, score: 0, tripped: false, eliminated: false, finished: null, lastRoll: null })); }); return { ...state, phase: 'race', racers, finishers: [], currentPlayer: 0, board: state.raceNumber % 2 ? 'Mild Mile' : 'Wild Wilds', log: [`第 ${state.raceNumber} 场 · ${state.raceNumber % 2 ? '温和大道' : '荒野狂奔'}`, '所有角色已揭示，玩家 A 先掷骰。'] }; }
function activeRacers(state: GameState) { return state.racers.filter((r) => !r.eliminated && r.finished === null); }
function nextPlayerIndex(state: GameState, racer: RacerState, repeat = false) { return repeat ? state.players.findIndex((p) => p.id === racer.ownerId) : (state.currentPlayer + 1) % state.players.length; }
function addLog(state: GameState, lines: string[]) { return [...state.log, ...lines].slice(-14); }

export function abilityActions(state: GameState, racer: RacerState | undefined) {
  if (!racer || racer.eliminated || racer.finished !== null) return [] as Array<{ id: AbilityActionId; targetIds: string[] }>;
  const active = activeRacers(state).filter((other) => other.id !== racer.id);
  const same = active.filter((other) => other.position === racer.position);
  const crowded = active.filter((other) => active.filter((candidate) => candidate.position === other.position).length === 2);
  const actions: Array<{ id: AbilityActionId; targetIds: string[] }> = [];
  if (racer.name === 'Legs') actions.push({ id: 'legs', targetIds: [] });
  if (racer.name === 'Rocket Scientist') actions.push({ id: 'rocket', targetIds: [] });
  if (racer.name === 'Magician') actions.push({ id: 'magician', targetIds: [] });
  if (racer.name === 'Genius') actions.push({ id: 'genius', targetIds: [] });
  if (racer.name === 'Flip Flop' && active.length) actions.push({ id: 'flip-flop', targetIds: active.map((other) => other.id) });
  if (racer.name === 'Hypnotist' && active.length) actions.push({ id: 'hypnotist', targetIds: active.map((other) => other.id) });
  if (racer.name === 'Third Wheel' && crowded.length) actions.push({ id: 'third-wheel', targetIds: crowded.map((other) => other.id) });
  if (racer.name === 'Cheerleader' && active.length) actions.push({ id: 'cheerleader', targetIds: [] });
  if (racer.name === 'Duelist' && same.length) actions.push({ id: 'duelist', targetIds: same.map((other) => other.id) });
  return actions;
}

export function activateAbility(state: GameState, racerId: string, action: AbilityActionId, targetId?: string): GameState {
  const racers = state.racers.map((racer) => ({ ...racer })); const racer = racers.find((item) => item.id === racerId); if (!racer) return state;
  const target = racers.find((item) => item.id === targetId); const lines: string[] = [];
  if (action === 'flip-flop' && target) { const old = racer.position; racer.position = target.position; target.position = old; lines.push(`${racer.name} 使用 Flip Flop，与 ${target.name} 交换格子。`); return { ...state, racers, currentPlayer: (state.currentPlayer + 1) % state.players.length, log: addLog(state, lines) }; }
  if (action === 'hypnotist' && target) { target.position = racer.position; lines.push(`${racer.name} 催眠 ${target.name}，将其 Warp 到自己所在格。`); }
  if (action === 'third-wheel' && target) { racer.position = target.position; lines.push(`${racer.name} 使用 Roll Through，Warp 到 ${target.name} 所在的双人格。`); }
  if (action === 'cheerleader') { const last = Math.min(...activeRacers(state).map((item) => item.position)); racers.filter((item) => item.finished === null && !item.eliminated && item.position === last).forEach((item) => { item.position = Math.min(29, item.position + 2); }); racer.position = Math.min(29, racer.position + 1); lines.push(`${racer.name} 为最后一名加油：最后一名移动 2 格，自己移动 1 格。`); }
  if (action === 'duelist' && target) { const ownRoll = Math.floor(Math.random() * 6) + 1; const targetRoll = Math.floor(Math.random() * 6) + 1; const winner = ownRoll >= targetRoll ? racer : target; winner.position = Math.min(29, winner.position + 2); lines.push(`DUEL！${racer.name} 掷 ${ownRoll}，${target.name} 掷 ${targetRoll}；${winner.name} 移动 2 格。`); }
  return { ...state, racers, log: addLog(state, lines) };
}

export function takeTurn(state: GameState, racerId?: string, options?: { ability?: AbilityActionId; prediction?: number }): GameState {
  if (state.phase !== 'race') return state;
  const actor = racerId ?? state.players[state.currentPlayer]?.id; const racer = state.racers.find((r) => r.ownerId === actor && !r.eliminated && r.finished === null); if (!racer) return { ...state, currentPlayer: (state.currentPlayer + 1) % state.players.length };
  const card = racerByName(racer.name); const lines: string[] = []; const skipRoll = options?.ability === 'legs'; const roll = skipRoll ? 5 : Math.floor(Math.random() * 6) + 1; racer.lastRoll = skipRoll ? null : roll; let distance = roll;
  const start = racer.position; const aloneInLead = racer.position === Math.max(...activeRacers(state).map((item) => item.position)) && activeRacers(state).filter((item) => item.position === racer.position).length === 1;
  if (racer.name === 'Alchemist' && roll <= 2) distance = 4;
  if (racer.name === 'Blimp') distance += start < 12 ? 3 : -1;
  if (racer.name === 'Hare') distance = aloneInLead ? 0 : distance + 2;
  if (racer.name !== 'Gunk' && activeRacers(state).some((item) => item.name === 'Gunk')) distance = Math.max(0, distance - 1);
  if (racer.name === 'Rocket Scientist' && options?.ability === 'rocket') { distance *= 2; racer.tripped = true; }
  if (racer.name === 'Magician' && options?.ability === 'magician') { const reroll = Math.floor(Math.random() * 6) + 1; lines.push(`${card.zhName} 使用 Poof 重掷：${roll} → ${reroll}。`); distance = reroll; racer.lastRoll = reroll; }
  if (options?.ability === 'legs') lines.push(`${card.zhName} 使用 Jog，跳过掷骰并移动 5 格。`);
  const path = Array.from({ length: Math.max(0, distance) }, (_, i) => start + i + 1); const passed = state.racers.filter((other) => other.id !== racer.id && path.includes(other.position) && !other.eliminated && other.finished === null);
  const overshoots = start + distance > 29 && state.racers.some((other) => other.name === 'Stickler' && !other.eliminated && other.finished === null && other.id !== racer.id);
  if (overshoots) distance = 0;
  racer.position = Math.min(30, Math.max(0, start + distance)); lines.push(`${card.zhName} 掷出 ${skipRoll ? '—' : roll}${distance !== roll && !skipRoll ? `，调整为 ${distance}` : ''}，从 ${start} 移动到 ${racer.position}。`);
  if (state.board === 'Wild Wilds') { const effect = wildEffects[racer.position]; if (effect === 'trip') { racer.tripped = true; lines.push(`${card.zhName} 停在 Trip 格。`); } if (effect === 'star') { racer.score += 1; lines.push(`${card.zhName} 获得 1 个星星分数筹码。`); } if (effect?.startsWith('+')) { racer.position = Math.min(30, racer.position + Number(effect)); lines.push(`箭头将 ${card.zhName} 向前移动 ${effect} 格。`); } if (effect?.startsWith('-')) { racer.position = Math.max(0, racer.position + Number(effect)); lines.push(`箭头将 ${card.zhName} 向后移动 ${effect} 格。`); } }
  if (racer.name === 'Banana') passed.forEach((other) => { other.tripped = true; lines.push(`${other.name} 被 Banana 经过并 Trip。`); });
  if (racer.name === 'M.O.U.T.H.') { const same = activeRacers(state).find((other) => other.id !== racer.id && other.position === racer.position); if (same) { same.eliminated = true; lines.push(`${same.name} 被 M.O.U.T.H. 淘汰。`); } }
  if (racer.position >= 30) { racer.finished = state.finishers.length + 1; state.finishers.push(racer.id); const placementPoints = racer.finished === 1 ? 4 : racer.finished === 2 ? 2 : 0; state.players.find((p) => p.id === racer.ownerId)!.score += placementPoints + racer.score; lines.push(`${card.zhName} 冲过终点，获得第 ${racer.finished} 名。`); }
  const repeat = options?.prediction === roll; if (repeat) lines.push(`${card.zhName} 预测正确，获得额外回合。`);
  const next = { ...state, currentPlayer: nextPlayerIndex(state, racer, repeat), log: addLog(state, lines) }; if (state.finishers.length >= 2 || activeRacers(state).length <= 1) return { ...next, phase: 'result' }; return next;
}

export function nextRace(state: GameState): GameState { if (state.raceNumber >= 4) return { ...state, phase: 'game-over' }; return beginRace({ ...state, raceNumber: state.raceNumber + 1 }); }
