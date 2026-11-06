const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow;
let watchlistWindow;

// Initialize the main search window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    backgroundColor: '#0f1014',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile('renderer/index.html');
}

// Initialize the secondary watchlist window
function createWatchlistWindow() {
  watchlistWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    backgroundColor: '#0f1014',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  watchlistWindow.loadFile('renderer/watchlist.html');
  
  // Reset window reference when closed
  watchlistWindow.on('closed', () => {
    watchlistWindow = null;
  });
}

// Handle IPC events for window navigation
ipcMain.on('open-watchlist', () => {
  if (watchlistWindow) {
    watchlistWindow.focus();
  } else {
    createWatchlistWindow();
  }
});

ipcMain.on('close-watchlist', () => {
  if (watchlistWindow) {
    watchlistWindow.close();
  }
  if (mainWindow) {
    mainWindow.focus();
  }
});

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});