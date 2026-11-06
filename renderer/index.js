const { ipcRenderer } = require('electron');

// DOM Elements
const openWatchlistBtn = document.getElementById('openWatchlistBtn');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchInput = document.getElementById('searchInput');
const trendingGrid = document.getElementById('trendingGrid');
const topRatedGrid = document.getElementById('topRatedGrid');
const resultsGrid = document.getElementById('resultsGrid');
const searchResultsSection = document.getElementById('searchResultsSection');
const homeDashboard = document.getElementById('homeDashboard');
const feedbackMessage = document.getElementById('feedbackMessage');

// API Configuration
const API_KEY = '54be7fa9'; 
const API_URL = 'https://www.omdbapi.com/';
const FALLBACK_POSTER = "https://placehold.co/300x450/1f1f1f/ffffff?text=No+Poster";

// Convert runtime format from "166 min" to "2h 46m"
function formatRuntime(runtimeStr) {
  if (!runtimeStr || runtimeStr === "N/A") return "N/A";
  const minutes = parseInt(runtimeStr);
  if (isNaN(minutes)) return runtimeStr;
  
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// Navigation
openWatchlistBtn.addEventListener('click', () => {
  ipcRenderer.send('open-watchlist');
});

// Generate HTML template for movie cards
function createMovieCard(movie) {
  const poster = (movie.Poster && movie.Poster !== "N/A") ? movie.Poster : FALLBACK_POSTER;
  const movieData = JSON.stringify(movie).replace(/'/g, "&#39;");
  
  return `
    <div class="movie-card glass-box">
      <div onclick="openMovieDetails('${movie.imdbID}')" style="cursor: pointer;">
        <img src="${poster}" onerror="this.onerror=null; this.src='${FALLBACK_POSTER}'" alt="${movie.Title}">
        <div class="card-info">
          <h3>${movie.Title}</h3>
          <p>${movie.Year}</p>
        </div>
      </div>
      <div style="padding: 0 15px 15px 15px;">
        <button onclick='saveToWatchlist(${movieData})'>➕ Add to List</button>
      </div>
    </div>
  `;
}

// Fetch dashboard data
async function loadTrending() {
  const titles = ['Dune: Part Two', 'Oppenheimer', 'Deadpool & Wolverine', 'Inside Out 2', 'The Batman'];
  try {
    const promises = titles.map(t => fetch(`${API_URL}?t=${encodeURIComponent(t)}&type=movie&apikey=${API_KEY}`).then(res => res.json()));
    const movies = await Promise.all(promises);
    movies.forEach(movie => {
      if(movie.Response === "True") trendingGrid.innerHTML += createMovieCard(movie);
    });
  } catch (error) {
    console.error("Trending fetch error", error);
  }
}

async function loadTopRated() {
  const titles = ['The Shawshank Redemption', 'The Godfather', 'The Dark Knight', 'Pulp Fiction', 'Forrest Gump'];
  try {
    const promises = titles.map(t => fetch(`${API_URL}?t=${encodeURIComponent(t)}&type=movie&apikey=${API_KEY}`).then(res => res.json()));
    const movies = await Promise.all(promises);
    movies.forEach(movie => {
      if(movie.Response === "True") topRatedGrid.innerHTML += createMovieCard(movie);
    });
  } catch (error) {
    console.error("Top rated fetch error", error);
  }
}

// Search functionality
searchBtn.addEventListener('click', async () => {
  const query = searchInput.value.trim();
  if (!query) return showFeedback("Please enter a movie title.", "error");

  homeDashboard.style.display = 'none';
  searchResultsSection.style.display = 'block';
  resultsGrid.innerHTML = '<p>Searching...</p>';

  try {
    const response = await fetch(`${API_URL}?s=${encodeURIComponent(query)}&type=movie&apikey=${API_KEY}`);
    const data = await response.json();

    if (data.Response === "False") {
      resultsGrid.innerHTML = '';
      showFeedback(`No results found: ${data.Error}`, "error");
      return;
    }
    feedbackMessage.style.display = "none";
    resultsGrid.innerHTML = data.Search.map(movie => createMovieCard(movie)).join('');
  } catch (error) {
    resultsGrid.innerHTML = '';
    showFeedback("Network error. Please check your connection.", "error");
  }
});

// Reset view to dashboard
clearSearchBtn.addEventListener('click', () => {
  searchResultsSection.style.display = 'none';
  homeDashboard.style.display = 'block';
  searchInput.value = '';
  feedbackMessage.style.display = "none";
});

// Save movie to local storage
window.saveToWatchlist = async function(movie) {
  let watchlist = JSON.parse(localStorage.getItem('myMovieWatchlist')) || [];
  if (watchlist.find(m => m.imdbID === movie.imdbID)) {
    return alert(`"${movie.Title}" is already in your watchlist.`);
  }

  try {
    // Fetch additional details for tracking
    const res = await fetch(`${API_URL}?i=${movie.imdbID}&apikey=${API_KEY}`);
    const fullData = await res.json();
    movie.runtime = fullData.Runtime; 
    movie.director = fullData.Director;
  } catch (e) {
    movie.runtime = "N/A";
    movie.director = "Unknown";
  }

  watchlist.push(movie);
  localStorage.setItem('myMovieWatchlist', JSON.stringify(watchlist));
  alert(`"${movie.Title}" added to your list!`);
};

// Display feedback alerts
function showFeedback(msg, type) {
  feedbackMessage.textContent = msg;
  feedbackMessage.className = `feedback ${type}`;
  feedbackMessage.style.display = "block";
  setTimeout(() => { feedbackMessage.style.display = "none"; }, 4000);
}

// Open detailed view modal
window.openMovieDetails = async function(imdbID) {
  const modal = document.getElementById('movieModal');
  modal.style.display = 'flex';
  
  document.getElementById('modalPoster').src = "https://placehold.co/300x450/1f1f1f/ffffff?text=Loading...";
  document.getElementById('modalTitle').textContent = "Loading...";
  document.getElementById('modalMeta').textContent = "";
  document.getElementById('modalPlot').textContent = "";

  try {
    const res = await fetch(`${API_URL}?i=${encodeURIComponent(imdbID)}&plot=full&apikey=${API_KEY}`);
    const data = await res.json();
    
    document.getElementById('modalPoster').src = (data.Poster && data.Poster !== "N/A") ? data.Poster : FALLBACK_POSTER;
    document.getElementById('modalTitle').textContent = data.Title;
    document.getElementById('modalMeta').textContent = `${data.Year} • ${formatRuntime(data.Runtime)} • ${data.Genre}`;
    document.getElementById('modalPlot').textContent = data.Plot;
    document.getElementById('modalDirector').textContent = data.Director;
    document.getElementById('modalActors').textContent = data.Actors;
  } catch (error) {
    document.getElementById('modalTitle').textContent = "Error loading details.";
  }
};

window.closeModal = function() {
  document.getElementById('movieModal').style.display = 'none';
};

// Load initial data on startup
window.addEventListener('DOMContentLoaded', () => {
  loadTrending();
  loadTopRated();
});