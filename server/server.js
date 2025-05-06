const express = require('express');
const app = express();
const port = 5000;

// Middleware pour gérer les requêtes JSON
app.use(express.json());

// Route pour tester le backend
app.get('/', (req, res) => {
  res.send('Video Repeater Server is running!');
});

// Démarre le serveur sur le port 5000
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
