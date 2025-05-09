// Configurações
const jsonFile = 'fh.json';
const apiUrl = 'https://flex.smokace718.com/pt-br/game/launch';

// Variáveis de Estado
let games = [];
let categories = new Map();
let favorites = new Set();
let currentColumnClass = 'one-column';
let currentView = 'all';
let currentFilteredGames = [];
let userId = null;

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAwK82kXolPs2iAt41PtQzYl7TEzjdg4Xc",
  authDomain: "gratisbet-78492.firebaseapp.com",
  databaseURL: "https://gratisbet-78492-default-rtdb.firebaseio.com",
  projectId: "gratisbet-78492",
  storageBucket: "gratisbet-78492.appspot.com",
  messagingSenderId: "922021397678",
  appId: "1:922021397678:web:3c4172a0843c1f442f593f"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Autenticação anônima
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    userId = user.uid;
    await loadFavorites();
    await loadGames();
  } else {
    firebase.auth().signInAnonymously().catch(error => {
      alert("Erro na autenticação: " + error.message);
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('searchBox');
  const categoryFilter = document.getElementById('categoryFilter');
  const favBtn = document.getElementById('showFavoritesButton');
  const allBtn = document.getElementById('showAllButton');

  searchBox?.addEventListener('input', filterGames);
  categoryFilter?.addEventListener('change', filterGames);
  favBtn?.addEventListener('click', () => {
    currentView = 'favorites';
    filterGames();
  });
  allBtn?.addEventListener('click', () => {
    currentView = 'all';
    filterGames();
  });
});

async function loadGames() {
  try {
    const response = await fetch(jsonFile);
    if (!response.ok) throw new Error(`Erro ao buscar JSON: ${response.statusText}`);
    const data = await response.json();
    if (!data.result || !Array.isArray(data.result)) {
      throw new Error('Formato inválido de JSON (esperado "result" como array)');
    }
    games = data.result;
    extractCategories(games);
    filterGames(); // aplica filtro após carregar
  } catch (error) {
    console.error('Erro ao carregar os jogos:', error);
    alert('Erro ao carregar os jogos: ' + error.message);
  }
}

function extractCategories(gameList) {
  categories.clear();
  gameList.forEach(game => {
    game.categories?.forEach(cat => {
      if (cat.category_id && cat.name) {
        categories.set(cat.category_id, cat.name);
      }
    });
  });
  populateCategoryFilter();
}

function populateCategoryFilter() {
  const categorySelect = document.getElementById('categoryFilter');
  if (!categorySelect) return;

  categorySelect.innerHTML = '<option value="">Todas as Categorias</option>';
  Array.from(categories.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([id, name]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      categorySelect.appendChild(option);
    });
}

function displayGames(gameList) {
  const container = document.getElementById('gameContainer');
  if (!container) return;

  container.className = `game-container ${currentColumnClass}`;
  container.innerHTML = gameList.map(game => `
    <div class="game-card" data-alias="${game.alias}">
      <img src="${game.images?.small || 'imagens/placeholder.jpg'}" alt="${game.name}" class="game-image">
      <div class="game-title">${game.name}</div>
      <div class="game-categories">${game.categories?.map(c => c.name).join(', ') || 'Sem categoria'}</div>
      <button onclick="startGame('${game.alias}')">Jogar</button>
      <button onclick="toggleFavorite('${game.alias}')">
        ${favorites.has(game.alias) ? 'Remover Favorito' : 'Favoritar'}
      </button>
    </div>
  `).join('');
}

function filterGames() {
  const query = document.getElementById('searchBox')?.value.toLowerCase() || '';
  const selectedCategory = document.getElementById('categoryFilter')?.value || '';
  const selectedCategoryId = parseInt(selectedCategory);
  const isCategorySelected = !isNaN(selectedCategoryId);

  let baseList = games;

  if (currentView === 'favorites') {
    baseList = baseList.filter(game => game.alias && favorites.has(game.alias));
  }

  const filtered = baseList.filter(game => {
    const nameMatch = game.name?.toLowerCase().includes(query);
    const categoryMatch = !isCategorySelected || game.categories?.some(c => c.category_id === selectedCategoryId);
    return nameMatch && categoryMatch;
  });

  currentFilteredGames = filtered;
  displayGames(filtered);
}

async function startGame(alias) {
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias, mode: 'demo' })
    });
    const data = await res.json();
    if (!data.result?.url) throw new Error('URL não encontrada');
    const url = new URL(data.result.url);
    url.searchParams.set("jurisdiction", "BR");
    url.searchParams.set("lobbyUrl", encodeURIComponent("https://freeslots-red.vercel.app/login.html"));
    url.searchParams.set("lang", "pt");
    url.searchParams.set("cur", "BRL");
    openModal(url.toString());
  } catch (err) {
    alert("Erro ao iniciar o jogo: " + err.message);
    console.error(err);
  }
}

function openModal(url) {
  const modal = document.getElementById('gameModal');
  const iframe = document.getElementById('gameFrame');
  const closeBtn = document.querySelector('.close-btn');
  if (!modal || !iframe || !closeBtn) return;

  // Bloquear fullscreen no iframe
  iframe.removeAttribute('allowfullscreen');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

  iframe.src = url;
  modal.style.display = 'block';

  closeBtn.onclick = () => {
    iframe.src = '';
    modal.style.display = 'none';
  };
}

function toggleFavorite(alias) {
  if (!alias) return;
  favorites.has(alias) ? favorites.delete(alias) : favorites.add(alias);
  saveFavorites();
  refreshCurrentView();
}

function refreshCurrentView() {
  filterGames(); // sempre reavalia com base no currentView
}

async function saveFavorites() {
  if (!userId) return;
  try {
    await db.ref(`users/${userId}/favorites`).set(Array.from(favorites));
  } catch (err) {
    console.error('Erro ao salvar favoritos:', err);
  }
}

async function loadFavorites() {
  if (!userId) return;
  try {
    const snapshot = await db.ref(`users/${userId}/favorites`).get();
    favorites = snapshot.exists() ? new Set(snapshot.val()) : new Set();
  } catch (err) {
    console.error('Erro ao carregar favoritos:', err);
  }
}

function setColumnLayout(layout) {
  currentColumnClass = layout;
  refreshCurrentView();
}

// Bloquear tentativas de fullscreen em qualquer iframe
document.addEventListener('fullscreenchange', () => {
  const fullscreenElement = document.fullscreenElement;
  if (fullscreenElement?.tagName === 'IFRAME') {
    document.exitFullscreen();
    console.warn('Tentativa de fullscreen em iframe bloqueada.');
  }
});
