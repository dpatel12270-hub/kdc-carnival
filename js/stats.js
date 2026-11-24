// Shared math for boards, live stats and game metrics.
const one = v => (Array.isArray(v) ? v[0] : v);
export const entryName = e => String(one(e.name) ?? '');
export const entryCount = e => Number(one(e.count)) || 0;
export const entryType = e => e.type || (entryName(e) === 'Tickets Deducted' || entryName(e) === 'Tokens Deducted' ? 'D' : 'G');
export const returnedName = n => (n.endsWith(' Returned') ? n.slice(0, -9) : n);

// side: only count prize moves for that side's list (I-Side / E-Side).
export function prizeMovement(participants, side) {
  const given = {}, returned = {};
  participants.forEach(p => (p.winningHistory || []).forEach(e => {
    if (side && (e.side || p.wing) !== side) return;
    const t = entryType(e);
    if (t === 'P') given[entryName(e)] = (given[entryName(e)] || 0) + 1;
    else if (t === 'R') { const n = returnedName(entryName(e)); returned[n] = (returned[n] || 0) + 1; }
  }));
  return { given, returned };
}

// Prize Board rows: pinned prizes first (in the order configured), then most tokens first, then A–Z.
export function prizeBoardRows(prizes, participants, side) {
  const { given, returned } = prizeMovement(participants, side);
  const rows = prizes.map((p, i) => {
    const total = Number(p.quantity) || 0;
    const net = (given[p.prize] || 0) - (returned[p.prize] || 0);
    return { ...p, idx: i, tokens: Number(p.tokens) || 0, total, net, remaining: total - net };
  });
  rows.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.pinned && b.pinned ? a.idx - b.idx : 0) || b.tokens - a.tokens || a.prize.localeCompare(b.prize));
  return rows;
}
export function stockLevel(r) {
  if (r.unlimited) return 'raffle';
  if (r.remaining <= 0) return 'out';
  const low = Math.max(3, Math.ceil(0.15 * r.total));
  return r.remaining < r.total && r.remaining <= low ? 'low' : 'ok';
}

export function liveStats(list) {
  const count = arr => {
    let withTokens = 0, tokensWon = 0, prizes = 0, goody = 0;
    arr.forEach(p => {
      if (p.isGoodBagReceived === true) goody++;
      const won = Number(p.totalTokenWon) || 0;
      if (won > 0) withTokens++;
      tokensWon += won;
      (p.winningHistory || []).forEach(e => { const t = entryType(e); if (t === 'P') prizes++; else if (t === 'R') prizes--; });
    });
    const n = arr.length, pct = v => (n ? Math.round(100 * v / n) : 0);
    return { registered: n, withTokens, activePct: pct(withTokens), tokensWon, prizesRedeemed: prizes, goodyBags: goody, goodyPct: pct(goody) };
  };
  const i = list.filter(p => p.wing === 'I-Side'), e = list.filter(p => p.wing === 'E-Side');
  const assigned = new Set([...i, ...e]);
  return { total: count(list), iSide: count(i), eSide: count(e), unassigned: count(list.filter(p => !assigned.has(p))) };
}

export function gameMetrics(participants, prizes, side) {
  const games = {}, kGames = [], kPrizes = [];
  let tokensAwarded = 0, tokensUsed = 0, maxAtOnce = 0;
  participants.forEach(p => {
    const who = `${p.firstName || ''} ${p.lastName || ''}`.trim();
    (p.winningHistory || []).forEach(e => {
      const t = entryType(e), n = entryName(e), c = entryCount(e), k = String(one(e.karyakarName) || 'Unknown');
      if (t === 'G') {
        const g = games[n] = games[n] || { name: n, i: 0, e: 0, total: 0, tokens: 0 };
        g.total++; g.tokens += c; if (p.wing === 'I-Side') g.i++; else if (p.wing === 'E-Side') g.e++;
        tokensAwarded += c; maxAtOnce = Math.max(maxAtOnce, c);
        kGames.push({ karyakar: k, game: n, tokens: c, participant: who, timestamp: e.timestamp });
      } else if (t === 'P' || t === 'R') {
        tokensUsed += t === 'P' ? Math.abs(c) : -Math.abs(c);
        kPrizes.push({ side: e.side || p.wing || '', karyakar: k, prize: t === 'R' ? returnedName(n) : n, action: t === 'R' ? 'Returned' : 'Given', tokens: Math.abs(c), participant: who, timestamp: e.timestamp });
      }
    });
  });
  const won = participants.map(p => Number(p.totalTokenWon) || 0).filter(v => v > 0);
  const { given, returned } = prizeMovement(participants, side);
  const qty = Object.fromEntries(prizes.map(p => [p.prize, Number(p.quantity) || 0]));
  const names = new Set([...Object.keys(given), ...Object.keys(returned), ...prizes.map(p => p.prize)]);
  const prizeRows = [...names].map(n => {
    const g = given[n] || 0, r = returned[n] || 0, total = qty[n] || 0;
    return { name: n, total, given: g, returned: r, net: g - r, remaining: total - (g - r) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const sortK = (a, b) => a.karyakar.localeCompare(b.karyakar) || (a.timestamp || '').localeCompare(b.timestamp || '');
  return {
    participants: participants.length,
    gameRows: Object.values(games).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    gamesPlayed: Object.values(games).reduce((s, g) => s + g.total, 0),
    prizeRows, prizesDistributed: prizeRows.reduce((s, r) => s + r.net, 0),
    tokensAwarded, tokensUsed, maxAtOnce,
    avgWon: won.length ? Math.round(won.reduce((a, b) => a + b, 0) / won.length) : 0,
    minWon: won.length ? Math.min(...won) : 0, maxWon: won.length ? Math.max(...won) : 0,
    kGames: kGames.sort(sortK), kPrizes: kPrizes.sort(sortK)
  };
}
