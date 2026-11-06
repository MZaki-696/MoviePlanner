const { ipcRenderer } = require('electron');

// DOM Elements
const watchlistContainer = document.getElementById('watchlistContainer');
const emptyMessage = document.getElementById('emptyMessage');
const suggestionText = document.getElementById('suggestionText');
const sortSelect = document.getElementById('sortSelect');

// Statistics Elements
const statTotal = document.getElementById('statTotal');
const statBacklog = document.getElementById('statBacklog');
const statOnHold = document.getElementById('statOnHold');
const statCompleted = document.getElementById('statCompleted');
const statTotalRuntime = document.getElementById('statTotalRuntime');

const API_KEY = '54be7fa9';
const API_URL = 'https://www.omdbapi.com/';
const FALLBACK_POSTER = "https://placehold.co/300x450/1f1f1f/ffffff?text=No+Poster";

// Movie Class with Encapsulation for private properties
class Movie {
  #rating;
  #notes;

  constructor(data) {
    this.id = data.imdbID || data.id;
    this.title = data.Title || data.title;
    this.year = data.Year || data.year;
    this.poster = data.Poster || data.poster;
    this.runtime = data.Runtime || data.runtime;
    this.status = data.status || "Plan to Watch";
    this.#rating = data.rating || 0;
    this.#notes = data.notes || "";
  }

  // Getter and Setter for rating
  get rating() { return this.#rating; }
  set rating(value) { this.#rating = value; }

  // Getter and Setter for notes
  get notes() { return this.#notes; }
  set notes(value) { this.#notes = value; }

  // Custom JSON serialization to handle private fields
  toJSON() {
    return {
      imdbID: this.id,
      Title: this.title,
      Year: this.year,
      Poster: this.poster,
      Runtime: this.runtime,
      status: this.status,
      rating: this.#rating,
      notes: this.#notes
    };
  }
}

// Load and reconstruct movie objects from local storage
let watchlist = [];
const rawData = JSON.parse(localStorage.getItem('myMovieWatchlist')) || [];
rawData.forEach(data => {
  watchlist.push(new Movie(data));
});

// Navigation
document.getElementById('backToHomeBtn').addEventListener('click', () => {
  ipcRenderer.send('close-watchlist');
});

// Convert runtime format from "166 min" to "2h 46m"
function formatRuntime(runtimeStr) {
  if (!runtimeStr || runtimeStr === "N/A") return "N/A";
  const minutes = parseInt(runtimeStr);
  if (isNaN(minutes)) return runtimeStr;
  
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// Generate star rating HTML
function getStarsHTML(index, rating) {
  let stars = '<div class="star-rating">';
  for (let i = 1; i <= 5; i++) {
    const activeClass = i <= rating ? 'active' : '';
    stars += `<span class="star ${activeClass}" onclick="updateRating(${index}, ${i})">★</span>`;
  }
  stars += '</div>';
  return stars;
}

// Render watchlist and calculate metrics
function renderWatchlist() {
  watchlistContainer.innerHTML = '';
  
  if (watchlist.length === 0) {
    emptyMessage.style.display = 'block';
    statTotal.textContent = '0';
    statBacklog.textContent = '0';
    statOnHold.textContent = '0';
    statCompleted.textContent = '0';
    statTotalRuntime.textContent = '0h 0m';
    return;
  }
  
  emptyMessage.style.display = 'none';
  
  let countBacklog = 0;
  let countOnHold = 0;
  let countCompleted = 0;
  let totalMinutes = 0;

  // Sort list based on selected criteria
  const sortBy = sortSelect.value;
  const statusPriority = { 'Plan to Watch': 1, 'On Hold': 2, 'Completed': 3 };
  
  watchlist.sort((a, b) => {
    if (sortBy === 'year') return (b.year || 0) - (a.year || 0);
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return statusPriority[a.status] - statusPriority[b.status];
  });

  let currentHeaderStatus = '';

  watchlist.forEach((movie, index) => {
    // Calculate dashboard metrics
    if (movie.status === 'Plan to Watch') countBacklog++;
    if (movie.status === 'On Hold') countOnHold++;
    if (movie.status === 'Completed') {
      countCompleted++;
      if (movie.runtime && movie.runtime !== "N/A") {
        totalMinutes += parseInt(movie.runtime) || 0;
      }
    }

    // Insert status headers when list is grouped
    if (sortBy === 'status' && movie.status !== currentHeaderStatus) {
      currentHeaderStatus = movie.status;
      const header = document.createElement('h2');
      header.className = 'status-header';
      
      let icon = "⏳";
      if (currentHeaderStatus === 'On Hold') icon = "⏸️";
      if (currentHeaderStatus === 'Completed') icon = "✅";
      
      header.innerHTML = `${icon} ${currentHeaderStatus}`;
      watchlistContainer.appendChild(header);
    }

    // Render individual movie card
    const poster = (movie.poster && movie.poster !== "N/A") ? movie.poster : FALLBACK_POSTER;
    const div = document.createElement('div');
    div.className = 'list-item glass-box';
    
    div.innerHTML = `
      <img src="${poster}" onerror="this.onerror=null; this.src='${FALLBACK_POSTER}'" alt="${movie.title}" onclick="openMovieDetails('${movie.id}')" class="poster-img">
      <div class="list-details">
        <h3 onclick="openMovieDetails('${movie.id}')" class="movie-title">${movie.title} <small>(${movie.year})</small></h3>
        
        <div class="controls">
          <select onchange="updateStatus(${index}, this.value)">
            <option value="Plan to Watch" ${movie.status === 'Plan to Watch' ? 'selected' : ''}>Plan to Watch</option>
            <option value="On Hold" ${movie.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
            <option value="Completed" ${movie.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
          ${getStarsHTML(index, movie.rating)}
        </div>

        <div class="tag-notes-container">
          <textarea class="review-notes" placeholder="Write your notes, tags, or review here..." onchange="updateNotes(${index}, this.value)">${movie.notes}</textarea>
        </div>
      </div>
      <button class="btn-delete" onclick="deleteMovie(${index})">Remove</button>
    `;
    watchlistContainer.appendChild(div);
  });

  // Update dashboard displays
  statTotal.textContent = watchlist.length;
  statBacklog.textContent = countBacklog;
  statOnHold.textContent = countOnHold;
  statCompleted.textContent = countCompleted;
  
  if (totalMinutes > 0) {
    statTotalRuntime.textContent = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  } else {
    statTotalRuntime.textContent = '0h 0m';
  }
}

// CRUD: Update Status
window.updateStatus = function(index, newStatus) {
  watchlist[index].status = newStatus;
  localStorage.setItem('myMovieWatchlist', JSON.stringify(watchlist));
  renderWatchlist(); 
};

// CRUD: Update Rating
window.updateRating = function(index, newRating) {
  watchlist[index].rating = newRating;
  localStorage.setItem('myMovieWatchlist', JSON.stringify(watchlist));
  renderWatchlist(); 
};

// CRUD: Update Notes
window.updateNotes = function(index, newNotes) {
  watchlist[index].notes = newNotes;
  localStorage.setItem('myMovieWatchlist', JSON.stringify(watchlist));
};

// CRUD: Delete
window.deleteMovie = function(index) {
  if (confirm("Are you sure you want to remove this movie?")) {
    watchlist.splice(index, 1);
    localStorage.setItem('myMovieWatchlist', JSON.stringify(watchlist));
    renderWatchlist();
  }
};

// Generate random movie suggestion from backlog
window.generateSuggestion = function() {
  if (watchlist.length === 0) {
    suggestionText.textContent = "Your list is empty. Add some movies first!";
    return;
  }
  
  const pool = watchlist.filter(m => m.status === 'Plan to Watch' || m.status === 'On Hold');
  
  if (pool.length === 0) {
    suggestionText.innerHTML = `🎉 You have completed everything on your list!<br>Go back to the Home page to find new movies.`;
    return;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  suggestionText.innerHTML = `🎲 The wheel has spoken!<br><strong style="color: #fff; font-size: 1.1em;">"${pick.title}"</strong> (${formatRuntime(pick.runtime)})`;
};

// Open detailed view modal
window.openMovieDetails = async function(imdbID) {
  document.getElementById('movieModal').style.display = 'flex';
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

// Initialize render on page load
window.addEventListener('DOMContentLoaded', renderWatchlist);