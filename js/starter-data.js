// KDC 2026 (ROK) games and prizes, copied from the old site on Nov 24, 2026.
// Configure Games / Configure Prizes offer to load these when the list is empty.
export const STARTER_GAMES = ['Climb the Vines', 'Frog Frenzy', "Goin' Bananas", 'Jungle Roll', 'Kobra Toss', 'Rainforest Rush',
  'Safari Splash', 'Swinging Showdown', 'Timber Toss', 'Toucan Rescue', 'Treetop Target']
  .map(game => ({ game, score1: 4, score2: 3, score3: 2, score4: 1 }));

const raffle = n => ({ prize: `${n} (Raffle)`, tokens: 10, quantity: 0, pinned: true, unlimited: true });
const item = (prize, tokens, quantity) => ({ prize, tokens, quantity, pinned: false, unlimited: false });
export const STARTER_PRIZES = [
  raffle('Retro Video Game'), raffle('GLOW Speaker'), raffle('Inflatable Chair'), raffle('Nitro Racer Set'), raffle('Basketball Hoop'),
  item('Speaker Sunglasses', 125, 1), item('Sugar Slime', 100, 1), item('Brick Set', 85, 1), item('Spider Man Web-Shooter', 75, 1),
  item('Tornado Race Car', 75, 1), item('Transformer Robot', 75, 1), item('Candy Rolls', 50, 1), item('Dragon Egg', 30, 24),
  item('Hershey Cookies & Cream', 25, 1), item('Mini Skateboard', 25, 30), item('Mini Snake Cube', 25, 24), item('Mini Soccer Ball Fidget', 25, 24),
  item('Animal Plush', 20, 24), item('Animal Rolling Ball Maze', 20, 24), item('KitKat', 20, 1), item("Reese's", 20, 1),
  item('Skittles', 20, 1), item('Sour Patch Kids', 20, 1), item('Hershey', 15, 1)
];
