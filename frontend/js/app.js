/**
 * ============================================================================
 * CINEVERSE - Frontend Application Engine
 * Integrated with FastAPI & Python NLP Recommendation Engine
 * Built adhering to UI/UX Pro Max Architecture
 * ============================================================================
 */

(function () {
  'use strict';

  const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
  const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';
  const FALLBACK_POSTER = 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg';
  const FALLBACK_BACKDROP = 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg';

  const state = {
    allMovies: [],
    currentFeatured: null,
    selectedMovie: null,
    activeGenre: 'all',
    activeSort: 'popular',
    searchQuery: '',
    searchDebounceTimer: null,
    stats: null
  };

  // --- API Client ---
  const API = {
    async getFeatured() {
      const res = await fetch('/api/movies/featured');
      if (!res.ok) throw new Error('Failed to load featured movie');
      return await res.json();
    },

    async getMovies(genre = 'all', sortBy = 'popular') {
      const url = `/api/movies?genre=${encodeURIComponent(genre)}&sort_by=${encodeURIComponent(sortBy)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load movie catalog');
      return await res.json();
    },

    async getMovieDetail(id) {
      const res = await fetch(`/api/movies/${id}`);
      if (!res.ok) throw new Error('Failed to load movie details');
      return await res.json();
    },

    async getRecommendations(id, topN = 8) {
      const res = await fetch(`/api/recommend/${id}?top_n=${topN}`);
      if (!res.ok) throw new Error('Failed to generate NLP recommendations');
      return await res.json();
    },

    async getRecommendationsByText(query, topN = 8) {
      const res = await fetch(`/api/recommend-by-text?q=${encodeURIComponent(query)}&top_n=${topN}`);
      if (!res.ok) throw new Error('Failed to search recommendations by plot query');
      return await res.json();
    },

    async searchCatalog(query) {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to search catalog');
      return await res.json();
    },

    async getGenres() {
      const res = await fetch('/api/genres');
      if (!res.ok) throw new Error('Failed to load genres');
      return await res.json();
    },

    async getStats() {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to load algorithm stats');
      return await res.json();
    }
  };

  // --- UI Helpers & Image Fallback System ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getFallbackPoster(param, year, genre = 'Cinema') {
    let cleanTitle = 'Film';
    let cleanYear = year || '';
    let cleanGenre = genre || 'Film';

    if (typeof param === 'number') {
      const found = state.allMovies.find(m => m.id === param);
      if (found) {
        cleanTitle = found.title || 'Film';
        cleanYear = found.release_year || '';
        cleanGenre = (found.genres && found.genres[0]) || 'Cinema';
      }
    } else if (typeof param === 'string') {
      cleanTitle = param || 'Film';
    }

    cleanTitle = cleanTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    cleanGenre = cleanGenre.replace(/&/g, '&amp;');

    // Split title if long
    let titleLines = [];
    if (cleanTitle.length > 18) {
      const words = cleanTitle.split(' ');
      let line1 = '', line2 = '';
      words.forEach(w => {
        if ((line1 + w).length <= 16) {
          line1 += (line1 ? ' ' : '') + w;
        } else {
          line2 += (line2 ? ' ' : '') + w;
        }
      });
      titleLines = [line1, line2 || ''];
    } else {
      titleLines = [cleanTitle];
    }

    const titleSvg = titleLines.map((l, idx) => 
      `<text x="200" y="${320 + (idx * 28)}" fill="#f8fafc" font-family="Plus Jakarta Sans, sans-serif" font-size="22" font-weight="800" text-anchor="middle" letter-spacing="-0.02em">${l}</text>`
    ).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">
      <defs>
        <linearGradient id="posterBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#141928"/>
          <stop offset="50%" stop-color="#1a2032"/>
          <stop offset="100%" stop-color="#0b0e17"/>
        </linearGradient>
        <radialGradient id="goldGlow" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill="url(#posterBg)"/>
      <rect width="400" height="600" fill="url(#goldGlow)"/>
      <rect x="20" y="20" width="360" height="560" rx="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      
      <!-- Film Slate / Clapper Graphic -->
      <g transform="translate(160, 160)">
        <circle cx="40" cy="40" r="45" fill="rgba(245,158,11,0.12)" stroke="rgba(245,158,11,0.4)" stroke-width="1.5"/>
        <path d="M30 26 L56 40 L30 54 Z" fill="#f59e0b"/>
      </g>
      
      <!-- Title & Meta -->
      ${titleSvg}
      <text x="200" y="390" fill="#f59e0b" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="700" text-anchor="middle">${cleanYear} &bull; ${cleanGenre}</text>
      
      <!-- Brand Badge -->
      <rect x="145" y="440" width="110" height="30" rx="15" fill="rgba(139,92,246,0.15)" stroke="rgba(139,92,246,0.4)" stroke-width="1"/>
      <text x="200" y="460" fill="#c4b5fd" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" text-anchor="middle" letter-spacing="0.08em">CINEVERSE</text>
    </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function getPosterUrl(path) {
    if (!path || path.length < 5) return FALLBACK_POSTER;
    return path.startsWith('http') ? path : `${TMDB_POSTER_BASE}${path}`;
  }

  function getBackdropUrl(path) {
    if (!path || path.length < 5) return FALLBACK_BACKDROP;
    return path.startsWith('http') ? path : `${TMDB_BACKDROP_BASE}${path}`;
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideInUp 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // --- Render Components ---

  function renderSkeletons(containerId, count = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton-poster"></div>
          <div class="skeleton-text" style="width: 70%;"></div>
          <div class="skeleton-text" style="width: 40%;"></div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function renderHero(movie) {
    if (!movie) return;
    state.currentFeatured = movie;

    const backdropImg = document.getElementById('hero-backdrop-img');
    const titleEl = document.getElementById('hero-title');
    const ratingEl = document.getElementById('hero-rating');
    const yearEl = document.getElementById('hero-year');
    const runtimeEl = document.getElementById('hero-runtime');
    const genresEl = document.getElementById('hero-genres');
    const overviewEl = document.getElementById('hero-overview');
    const recommendBtn = document.getElementById('hero-recommend-btn');
    const detailsBtn = document.getElementById('hero-details-btn');

    if (backdropImg) {
      backdropImg.onerror = () => {
        backdropImg.onerror = null;
        backdropImg.src = FALLBACK_BACKDROP;
      };
      backdropImg.src = getBackdropUrl(movie.backdrop_path);
      backdropImg.alt = movie.title;
    }
    if (titleEl) titleEl.textContent = movie.title;
    if (ratingEl) ratingEl.innerHTML = `★ ${movie.vote_average.toFixed(1)}`;
    if (yearEl) yearEl.textContent = movie.release_year;
    if (runtimeEl) runtimeEl.textContent = movie.runtime ? `${movie.runtime} min` : '148 min';
    if (overviewEl) overviewEl.textContent = movie.overview;

    if (genresEl && Array.isArray(movie.genres)) {
      genresEl.innerHTML = movie.genres.slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join('');
    }

    if (recommendBtn) {
      recommendBtn.onclick = () => {
        requestRecommendations(movie.id, movie.title);
      };
    }

    if (detailsBtn) {
      detailsBtn.onclick = () => {
        openModal(movie);
      };
    }
  }

  function renderGenres(genresList) {
    const bar = document.getElementById('genre-pills-bar');
    if (!bar) return;

    let html = `<button type="button" class="btn-genre-pill active" data-genre="all" onclick="window.CineVerse.filterGenre('all', this)">All Genres</button>`;
    genresList.forEach(g => {
      html += `<button type="button" class="btn-genre-pill" data-genre="${g.name}" onclick="window.CineVerse.filterGenre('${g.name}', this)">${g.name} (${g.count})</button>`;
    });
    bar.innerHTML = html;
  }

  function renderMovieCard(movie, isRecommendation = false) {
    const posterUrl = getPosterUrl(movie.poster_path);
    const genres = Array.isArray(movie.genres) ? movie.genres.slice(0, 2) : [];
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '7.5';

    let similarityBadgeHtml = '';
    if (isRecommendation && movie.match_percentage) {
      similarityBadgeHtml = `
        <div class="similarity-badge" title="Cosine Similarity Score: ${movie.nlp_similarity_score}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>${movie.match_percentage}% Match</span>
        </div>
      `;
    }

    return `
      <article class="movie-card" data-id="${movie.id}" onclick="window.CineVerse.inspectMovie(${movie.id})">
        <div class="movie-poster-box">
          ${similarityBadgeHtml}
          <div class="rating-badge">★ ${rating}</div>
          <img 
            src="${posterUrl}" 
            alt="${escapeHtml(movie.title)}" 
            class="movie-poster-img" 
            loading="lazy" 
            onerror="this.onerror=null; this.src=window.CineVerse.getFallbackPoster(${movie.id});"
          >
          
          <div class="card-hover-overlay">
            <button type="button" class="btn-card-recommend" onclick="event.stopPropagation(); window.CineVerse.requestRecommendations(${movie.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
              <span>Recommend Similar</span>
            </button>
          </div>
        </div>

        <div class="movie-card-info">
          <h3 class="movie-card-title" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</h3>
          <div class="movie-card-meta">
            <span class="num-tabular">${movie.release_year}</span>
            <span>${escapeHtml(movie.director ? movie.director.split(',')[0] : '')}</span>
          </div>
          <div class="movie-card-genres">
            ${genres.map(g => `<span class="genre-tag-sm">${escapeHtml(g)}</span>`).join('')}
          </div>
        </div>
      </article>
    `;
  }

  function renderMoviesGrid(movies) {
    const grid = document.getElementById('movies-grid');
    if (!grid) return;

    if (!movies || movies.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3>No Movies Found</h3>
          <p>No films matched your active filter or search keywords. Try adjusting your query or genre tab.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = movies.map(m => renderMovieCard(m, false)).join('');
  }

  function renderRecommendationsGrid(recommendations, sourceTitle) {
    const section = document.getElementById('recommendations-section');
    const grid = document.getElementById('recommendations-grid');
    const targetTitleEl = document.getElementById('rec-target-title');
    const targetSubtitleEl = document.getElementById('rec-target-subtitle');

    if (!section || !grid) return;

    if (targetTitleEl) targetTitleEl.textContent = sourceTitle;
    if (targetSubtitleEl) {
      targetSubtitleEl.textContent = `Content-based cosine similarity calculated across plot synopsis, genre weights, thematic keywords, and directorial authorial patterns.`;
    }

    grid.innerHTML = recommendations.map(m => renderMovieCard(m, true)).join('');
    section.classList.add('active');

    // Smooth scroll to recommendations section
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Modal Operations ---
  function openModal(movie) {
    state.selectedMovie = movie;
    const modal = document.getElementById('movie-modal');
    if (!modal) return;

    const modalBackdrop = document.getElementById('modal-backdrop-img');
    modalBackdrop.onerror = () => {
      modalBackdrop.onerror = null;
      modalBackdrop.src = FALLBACK_BACKDROP;
    };
    modalBackdrop.src = getBackdropUrl(movie.backdrop_path);

    const modalPoster = document.getElementById('modal-poster-img');
    modalPoster.onerror = () => {
      modalPoster.onerror = null;
      modalPoster.src = getFallbackPoster(movie.title, movie.release_year, (movie.genres && movie.genres[0]) || 'Cinema');
    };
    modalPoster.src = getPosterUrl(movie.poster_path);

    document.getElementById('modal-title').textContent = movie.title;
    document.getElementById('modal-tagline').textContent = movie.tagline ? `"${movie.tagline}"` : '';
    document.getElementById('modal-rating').innerHTML = `★ ${movie.vote_average ? movie.vote_average.toFixed(1) : '7.5'}`;
    document.getElementById('modal-year').textContent = movie.release_year;
    document.getElementById('modal-runtime').textContent = movie.runtime ? `${movie.runtime} min` : 'N/A';
    document.getElementById('modal-overview').textContent = movie.overview;
    document.getElementById('modal-director').textContent = movie.director || 'Unknown';
    document.getElementById('modal-cast').textContent = Array.isArray(movie.cast) ? movie.cast.slice(0, 4).join(', ') : 'N/A';

    const genresEl = document.getElementById('modal-genres');
    if (genresEl && Array.isArray(movie.genres)) {
      genresEl.innerHTML = movie.genres.map(g => `<span class="genre-tag">${g}</span>`).join('');
    }

    const keywordsEl = document.getElementById('modal-keywords');
    if (keywordsEl && Array.isArray(movie.keywords)) {
      keywordsEl.innerHTML = movie.keywords.map(k => `<span class="genre-tag" style="background: rgba(139,92,246,0.15); border-color: var(--border-violet); color: #c4b5fd;">#${k}</span>`).join('');
    }

    const recBtn = document.getElementById('modal-recommend-btn');
    if (recBtn) {
      recBtn.onclick = () => {
        closeModal();
        requestRecommendations(movie.id, movie.title);
      };
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('movie-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function openStatsModal() {
    const modal = document.getElementById('stats-modal');
    if (!modal) return;

    if (state.stats) {
      const countEl = document.getElementById('stat-movies-count');
      const vocabEl = document.getElementById('stat-vocab-size');
      const ratingEl = document.getElementById('stat-avg-rating');
      if (countEl) countEl.textContent = state.stats.total_movies;
      if (vocabEl) vocabEl.textContent = state.stats.vocabulary_size.toLocaleString();
      if (ratingEl) ratingEl.textContent = `★ ${state.stats.average_rating}`;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeStatsModal() {
    const modal = document.getElementById('stats-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function handleModalBackdropClick(e) {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal();
      closeStatsModal();
    }
  }

  // --- Recommendation Request Handlers ---
  async function requestRecommendations(movieId, movieTitle) {
    try {
      const source = state.allMovies.find(m => m.id === movieId);
      const title = movieTitle || (source ? source.title : 'Selected Film');
      showToast(`Generating NLP recommendations for <strong>${escapeHtml(title)}</strong>...`, 'success');
      const data = await API.getRecommendations(movieId, 8);
      const displayTitle = data.source_movie?.title || title;
      renderRecommendationsGrid(data.recommendations, displayTitle);
      showToast(`Loaded ${data.recommendation_count} ranked matches for ${escapeHtml(displayTitle)}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Failed to compute recommendations: ${err.message}`, 'error');
    }
  }

  async function runNlpPrompt(promptQuery) {
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) searchInput.value = promptQuery;
    
    try {
      renderSkeletons('recommendations-grid', 6);
      document.getElementById('recommendations-section').classList.add('active');
      document.getElementById('rec-target-title').textContent = `Query: "${promptQuery}"`;
      document.getElementById('rec-target-subtitle').textContent = `Ranked via cosine similarity of query vector transformed in the movie corpus TF-IDF feature space.`;

      showToast(`Running NLP similarity search for "${promptQuery}"...`, 'success');
      const data = await API.getRecommendationsByText(promptQuery, 8);
      renderRecommendationsGrid(data.recommendations, `Query: "${promptQuery}"`);
      showToast(`Found ${data.count} semantically matching movies!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`NLP Query failed: ${err.message}`, 'error');
    }
  }

  // --- Filtering & Sorting ---
  async function filterGenre(genre, btnElement) {
    state.activeGenre = genre;

    // Update active button state
    document.querySelectorAll('.btn-genre-pill').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    try {
      renderSkeletons('movies-grid', 8);
      const data = await API.getMovies(state.activeGenre, state.activeSort);
      renderMoviesGrid(data.movies);
      const heading = document.getElementById('catalog-heading');
      if (heading) {
        heading.textContent = genre === 'all' ? 'Explore Movie Catalog' : `${genre} Movies`;
      }
    } catch (err) {
      console.error(err);
      showToast('Error filtering movies', 'error');
    }
  }

  async function handleSortChange(sortVal) {
    state.activeSort = sortVal;
    try {
      renderSkeletons('movies-grid', 8);
      const data = await API.getMovies(state.activeGenre, state.activeSort);
      renderMoviesGrid(data.movies);
    } catch (err) {
      console.error(err);
      showToast('Error sorting movies', 'error');
    }
  }

  // --- Search Handlers ---
  function handleSearchInput(e) {
    const query = e.target.value.trim();
    state.searchQuery = query;

    const clearBtn = document.getElementById('btn-clear-search');
    if (clearBtn) {
      clearBtn.style.display = query.length > 0 ? 'block' : 'none';
    }

    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(async () => {
      try {
        if (query.length === 0) {
          const data = await API.getMovies(state.activeGenre, state.activeSort);
          renderMoviesGrid(data.movies);
          return;
        }

        const data = await API.searchCatalog(query);
        renderMoviesGrid(data.movies);
        const heading = document.getElementById('catalog-heading');
        if (heading) {
          heading.textContent = `Search Results for "${query}" (${data.count})`;
        }
      } catch (err) {
        console.error(err);
      }
    }, 280);
  }

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    const query = state.searchQuery;
    if (!query || query.length < 2) return;

    // Run semantic NLP query on full submit
    runNlpPrompt(query);
  }

  function clearSearch() {
    const input = document.getElementById('main-search-input');
    if (input) input.value = '';
    state.searchQuery = '';
    const clearBtn = document.getElementById('btn-clear-search');
    if (clearBtn) clearBtn.style.display = 'none';

    filterGenre(state.activeGenre);
  }

  function resetCatalog() {
    clearSearch();
    filterGenre('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function inspectMovie(id) {
    try {
      const movie = await API.getMovieDetail(id);
      openModal(movie);
    } catch (err) {
      console.error(err);
      showToast('Could not load movie details', 'error');
    }
  }

  // --- Scroll Effects ---
  function initScrollListener() {
    const header = document.getElementById('site-header');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        header?.classList.add('scrolled');
      } else {
        header?.classList.remove('scrolled');
      }
    });
  }

  // --- App Initialization ---
  async function init() {
    initScrollListener();
    renderSkeletons('movies-grid', 10);

    const searchInput = document.getElementById('main-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', handleSearchInput);
    }

    // Keyboard ESC to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeStatsModal();
      }
    });

    try {
      // 1. Load Main Catalog first
      try {
        const moviesData = await API.getMovies('all', 'popular');
        state.allMovies = moviesData.movies;
        renderMoviesGrid(moviesData.movies);
      } catch (err) {
        console.error('Movies catalog failed to load:', err);
        showToast('Error connecting to recommendation server', 'error');
      }

      // 2. Load Featured Hero Movie
      try {
        const featured = await API.getFeatured();
        renderHero(featured);
      } catch (err) {
        console.warn('Featured movie failed to load:', err);
      }

      // 3. Load Genres Bar
      try {
        const genresData = await API.getGenres();
        renderGenres(genresData.genres);
      } catch (err) {
        console.warn('Genres failed to load:', err);
      }

      // 4. Load Stats
      try {
        const stats = await API.getStats();
        state.stats = stats;
        console.log('CineVerse NLP Recommender Engine initialized:', stats);
      } catch (err) {
        console.warn('Stats failed to load:', err);
      }
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  // Expose global methods
  window.CineVerse = {
    init,
    filterGenre,
    handleSortChange,
    handleSearchSubmit,
    clearSearch,
    resetCatalog,
    inspectMovie,
    requestRecommendations,
    runNlpPrompt,
    openModal,
    closeModal,
    openStatsModal,
    closeStatsModal,
    handleModalBackdropClick,
    getFallbackPoster
  };

  // Kickoff on DOM loaded
  document.addEventListener('DOMContentLoaded', init);
})();
