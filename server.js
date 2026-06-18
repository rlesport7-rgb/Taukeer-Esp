const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const readJSON = (file) => {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const writeJSON = (file, data) => {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

const DEFAULT_AVATAR_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAADaUlEQVR4nO2dO27jQBCGd3lKkSZA7sGcQeYAUoXcQeQI5gZSRR4gR0h1AKnCiAu4W5KzSDAUQEiWZL9Hshf2T8CaSP4Bfg5G5nLMz6IoCEMAAAAAAMDnItvS5XDk+XDgeRjJvM9glw8Dz4eRJN7n4PWhfC51GR63sc1lbMAAwD2y7+lXeZoOBx6HkYz7TL69jDeU+2yheRjJfaKPuLhGwAAaSo/Hp+Dj2Tyv+DbNaU2T6/gBwD2yHcbMpx5iYip5u79pcZ3mAcPzMM64ZPyg+H5n2z+3eU1zM3F0fH5u4XMaAymH7v1mUJqDaV7T5BgBgD+CiOVhdpfHPrS5TXPiuLqOWH5OvCb/2fPzMOPQ4rUZDulWXvwzRtS0YBhVdU+HlBPT0jUCAH8MExM2w3kz3g9tbtOc7K6uYwo+Dkdn4jXt+wBjsz2Mrd9cj9sY1f5TmuYtAgA4ADGZGB+36Lx3f5pmuYyRIRsLRmD6Hc2xCAAAFZgfxljBjAtxseA4J7TjMo4bMK7APh9Nv/+9d27GMkYHwBCoBuIuME5A9APZ6Rq3YYShAADukDH49RwGZ+IZXzQbYTTl3/0B4BmGAIwKGAMkz12uBh7DcYcT7zA3P/eoFajvlWPjTq9jpH1eN39M9yBrfdUE7mH0x7ilj6kOwzX2fDC2rFVVQ9YhhsE7PyYYyQyHYrgNXwTYx/lzUen1nZcB5pAeDR7jB/axZQfqR3l5ngMA4B2sP0YJjBISeR9wz9cY5d9r1rE9aG1ftbtxAS+zC2AxB8BjI+oz0J7GmAGr2cg2lo7lfn5zr54a+BZ/2jgUeTF/r1XNdw3shSEAB8FCoBz2xZjQ7SO9nIu8bDUBrMZYxO8S/zjmvTkAADwjNgBxRTB3yHncrP23Wvt8Xl9zLNcA4BqoF24b6Un0kGd1HzHi1pGZZwA4H6gT7hvxI/Hqq5k9jzBmZDROHJo5+wBwHlAbfk7EJ1PrR7yjTt08ATgN1IDfI3GJSF/JrGQjRlo3TwCCUQF+TsRHUOvnv5i/FYv2/gBAZ1B5fk7EJ9Lqzb8R56+bn/UA8M6l2vH3RdoXc4gAAAAAAHhL/gM7hBzR/AqHXAAAAABJRU5ErkJggg==';

['default-u.png', 'shadow.png'].forEach(f => {
  const p = path.join(uploadDir, f);
  if (!fs.existsSync(p)) fs.writeFileSync(p, Buffer.from(DEFAULT_AVATAR_BASE64, 'base64'));
});

// Default players (5 unknowns)
const defaultPlayers = Array.from({ length: 5 }, (_, i) => ({
  id: 'p' + Date.now() + i,
  name: 'Unknown',
  role: 'unknown',
  photo: '/uploads/default-u.png',
  bio: 'Unknown player',
  joinDate: new Date().toISOString().slice(0,10),
  social: { twitter: '#', twitch: '#' },
  stats: { kills: 0, deaths: 0, assists: 0, accuracy: 0.5, headshots: 0, roundsWon: 0, mvp: 0 }
}));

// Only Free Fire Max Rosters
const defaultLibrary = [
  { id: 'lib1', name: 'Free Fire Max Rosters', logo: '/uploads/shadow.png' }
];

if (!fs.existsSync(path.join(DATA_DIR, 'players.json'))) writeJSON('players.json', defaultPlayers);
if (!fs.existsSync(path.join(DATA_DIR, 'games.json'))) writeJSON('games.json', []);
if (!fs.existsSync(path.join(DATA_DIR, 'library.json'))) writeJSON('library.json', defaultLibrary);
if (!fs.existsSync(path.join(DATA_DIR, 'team.json'))) writeJSON('team.json', { name: 'SHOOTING STARS', description: 'Professional eSports org', region: 'NA', founded: '2023' });

// ---------- API Routes ----------
app.get('/api/players', (req, res) => res.json(readJSON('players.json')));
app.post('/api/players', upload.single('photo'), (req, res) => {
  const players = readJSON('players.json');
  const newPlayer = JSON.parse(req.body.player);
  if (req.file) newPlayer.photo = '/uploads/' + req.file.filename;
  newPlayer.id = 'p' + Date.now();
  players.push(newPlayer);
  writeJSON('players.json', players);
  res.status(201).json(newPlayer);
});
app.put('/api/players/:id', upload.single('photo'), (req, res) => {
  const players = readJSON('players.json');
  const idx = players.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });
  const updated = JSON.parse(req.body.player);
  if (req.file) updated.photo = '/uploads/' + req.file.filename;
  players[idx] = { ...players[idx], ...updated };
  writeJSON('players.json', players);
  res.json(players[idx]);
});
app.delete('/api/players/:id', (req, res) => {
  let players = readJSON('players.json');
  players = players.filter(p => p.id !== req.params.id);
  writeJSON('players.json', players);
  res.status(204).send();
});

app.get('/api/games', (req, res) => res.json(readJSON('games.json')));
app.post('/api/games', (req, res) => {
  const games = readJSON('games.json');
  const newGame = { ...req.body, id: 'g' + Date.now(), playerStats: [] };
  games.push(newGame);
  writeJSON('games.json', games);
  res.status(201).json(newGame);
});
app.put('/api/games/:id', (req, res) => {
  const games = readJSON('games.json');
  const idx = games.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Game not found' });
  games[idx] = { ...games[idx], ...req.body };
  writeJSON('games.json', games);
  res.json(games[idx]);
});
app.delete('/api/games/:id', (req, res) => {
  let games = readJSON('games.json');
  games = games.filter(g => g.id !== req.params.id);
  writeJSON('games.json', games);
  res.status(204).send();
});

app.get('/api/library', (req, res) => res.json(readJSON('library.json')));
app.put('/api/library/:id', (req, res) => {
  const library = readJSON('library.json');
  const idx = library.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Library item not found' });
  library[idx] = { ...library[idx], ...req.body };
  writeJSON('library.json', library);
  res.json(library[idx]);
});
app.delete('/api/library/:id', (req, res) => {
  let library = readJSON('library.json');
  library = library.filter(l => l.id !== req.params.id);
  writeJSON('library.json', library);
  res.status(204).send();
});

app.get('/api/team', (req, res) => res.json(readJSON('team.json')));
app.put('/api/team', (req, res) => {
  writeJSON('team.json', req.body);
  res.json(req.body);
});

// Clear all data endpoint (no auth)
app.post('/api/clear-all', (req, res) => {
  // Reset players to 5 unknowns
  const freshPlayers = Array.from({ length: 5 }, (_, i) => ({
    id: 'p' + Date.now() + i,
    name: 'Unknown',
    role: 'unknown',
    photo: '/uploads/default-u.png',
    bio: 'Unknown player',
    joinDate: new Date().toISOString().slice(0,10),
    social: { twitter: '#', twitch: '#' },
    stats: { kills: 0, deaths: 0, assists: 0, accuracy: 0.5, headshots: 0, roundsWon: 0, mvp: 0 }
  }));
  writeJSON('players.json', freshPlayers);
  writeJSON('games.json', []);
  // Keep library and team settings
  res.json({ message: 'All player and match data cleared.' });
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
