/**
 * Game catalog — mock data similar to BitStarz game library
 */
const GAME_ICONS = window.Icons?.GAME_ICON_SET || ['dices', 'cherry', 'gem', 'spade', 'dices', 'star', 'flame', 'crown', 'clover', 'target', 'sparkles', 'zap', 'moon', 'zap', 'tent'];
const PROVIDERS = ['Pragmatic Play', 'Evolution', 'NetEnt', "Play'n GO", 'BGaming', 'Push Gaming', 'Hacksaw', 'Microgaming', 'Relax Gaming', 'Nolimit City'];

const GAME_TITLES = [
  'Wolf Gold', 'Sweet Bonanza', 'Gates of Olympus', 'Book of Dead', 'Starburst',
  'Mega Moolah', 'Lightning Roulette', 'Crazy Time', 'Monopoly Live', 'Blackjack VIP',
  'Fruit Party', 'Big Bass Bonanza', 'Sugar Rush', 'Dead or Alive 2', 'Gonzo Quest',
  'Reactoonz', 'Jammin Jars', 'Razor Shark', 'Wanted Dead', 'Mental',
  'Fire Joker', 'Legacy of Dead', 'Buffalo King', 'Dog House', 'Fruit Shop',
  'Immortal Romance', 'Thunderstruck II', 'Divine Fortune', 'Hall of Gods', 'Mega Fortune',
  'Aviator', 'Plinko', 'Mines', 'Dice', 'Limbo',
  'Baccarat Squeeze', 'Dragon Tiger', 'Sic Bo', 'Casino Holdem', 'Three Card Poker',
  'Gem Rocks', 'Vikings Go Berzerk', 'Valley of the Gods', 'Egyptian Dreams', 'Aztec Gold',
  'Lucky Lady Moon', 'Elvis Frog', 'Alien Fruits', 'Bonanza Billion', 'Wild Cash',
];

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function generateGames(count) {
  const games = [];
  const usedTitles = new Set();

  for (let i = 0; i < count; i++) {
    let title = GAME_TITLES[i % GAME_TITLES.length];
    if (usedTitles.has(title)) title = `${title} ${Math.floor(i / GAME_TITLES.length) + 1}`;
    usedTitles.add(title);

    const categories = ['slots', 'live', 'table', 'jackpot', 'new', 'provably'];
    const category = i < 8 ? 'slots' : categories[Math.floor(Math.random() * categories.length)];

    games.push({
      id: `game-${i + 1}`,
      title,
      provider: PROVIDERS[i % PROVIDERS.length],
      category,
      icon: GAME_ICONS[i % GAME_ICONS.length],
      badge: i % 7 === 0 ? 'hot' : i % 11 === 0 ? 'new' : i % 13 === 0 ? 'jackpot' : null,
      gradient: `hsl(${(i * 37) % 360}, 45%, 25%)`,
    });
  }
  return games;
}

const ALL_GAMES = generateGames(80);

function getGamesByCategory(category, limit = 12) {
  if (category === 'all') return ALL_GAMES.slice(0, limit);
  if (category === 'new') return ALL_GAMES.filter((g) => g.badge === 'new' || g.category === 'new').slice(0, limit);
  return ALL_GAMES.filter((g) => g.category === category || (category === 'jackpot' && g.badge === 'jackpot')).slice(0, limit);
}

function searchGames(query, filter = 'all') {
  const q = query.toLowerCase().trim();
  return ALL_GAMES.filter((g) => {
    const matchesFilter = filter === 'all' || g.category === filter || (filter === 'jackpot' && g.badge === 'jackpot');
    const matchesQuery = !q || g.title.toLowerCase().includes(q) || g.provider.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });
}

function renderGameCard(game) {
  const badgeHtml = game.badge
    ? `<span class="game-badge ${game.badge}">${game.badge}</span>`
    : '';
  const iconHtml = window.Icons?.inline(game.icon, 40, 'icon game-card-icon') || '';
  return `
    <article class="game-card" data-game-id="${game.id}">
      <div class="game-thumb" style="background: linear-gradient(145deg, ${game.gradient}, var(--bg-card))">
        ${badgeHtml}
        <div class="game-thumb-placeholder">${iconHtml}</div>
      </div>
      <h3>${game.title}</h3>
      <p>${game.provider}</p>
    </article>
  `;
}

function renderGameSlider(containerId, games) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = games.map(renderGameCard).join('');
}

function getGameById(id) {
  return ALL_GAMES.find((g) => g.id === id);
}

// Export to global scope
window.GameCatalog = {
  ALL_GAMES,
  getGamesByCategory,
  searchGames,
  renderGameCard,
  renderGameSlider,
  getGameById,
};
