const express = require("express");
const { MOVIES } = require("flixhq-core");
const axios = require("axios");
const path = require("path");

const app = express();
const flixhq = new MOVIES.FlixHQ();

const PORT = process.env.PORT || 3000;

// Serve static assets like CSS
app.use(express.static(path.join(__dirname, "public")));

// Frontend route to play a movie or TV show
app.get("/play", (req, res) => {
  const query = req.query.name || "";
  const season = req.query.season || null;
  const episode = req.query.episode || null;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Searching for "${query}"</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', sans-serif;
          background: #111;
          color: #fff;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          flex-direction: column;
          overflow: hidden;
        }
        .loader {
          border: 6px solid #444;
          border-top: 6px solid #09f;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin-top: 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        iframe {
          width: 100vw;
          height: 100vh;
          border: none;
          display: none;
        }
      </style>
    </head>
    <body>
      <div id="status">Searching for "<strong>${query}</strong>"...</div>
      <div class="loader"></div>

      <iframe id="player"></iframe>

      <script>
        fetch("/full?search=${encodeURIComponent(query)}&season=${encodeURIComponent(season)}&episode=${encodeURIComponent(episode)}")
          .then(res => {
            if (!res.ok) {
              throw new Error("Failed to fetch data");
            }
            return res.json();
          })
          .then(data => {
            const iframe = document.getElementById("player");
            if (data.modifiedLink) {
              iframe.src = data.modifiedLink;
              iframe.style.display = "block"; // Show iframe once link is ready
              document.getElementById("status").style.display = "none"; // Hide status
              document.querySelector(".loader").style.display = "none"; // Hide loader
            } else {
              document.getElementById("status").innerText = "❌ Error loading video.";
              document.querySelector(".loader").style.display = "none"; // Hide loader
            }
          })
          .catch(err => {
            document.getElementById("status").innerText = "❌ Something went wrong.";
            document.querySelector(".loader").style.display = "none"; // Hide loader
          });
      </script>
    </body>
    </html>
  `);
});

// Backend logic to fetch video information
app.get("/full", async (req, res) => {
  const searchQuery = req.query.search;
  const season = req.query.season || null;
  const episode = req.query.episode || null;

  if (!searchQuery) return res.status(400).json({ error: "Missing 'search' query parameter." });

  try {
    console.log(`Searching for: ${searchQuery}`);

    const searchResults = await flixhq.search(searchQuery);
    console.log('Search Results:', searchResults);

    const firstResult = searchResults.results[0];
    if (!firstResult) return res.status(404).json({ error: "No results found." });

    const id = firstResult.id;
    const info = await flixhq.fetchMovieInfo(id);
    console.log('Movie Info:', info);

    let episodeId = null;

    if (season && episode) {
      const episodeInfo = info.episodes.find(e => e.season === parseInt(season) && e.episode === parseInt(episode));
      episodeId = episodeInfo ? episodeInfo.id : null;
    } else {
      episodeId = info.episodes[0]?.id; // Default to first episode if no season/episode is provided
    }

    const servers = await flixhq.fetchEpisodeServers(id, episodeId);
    const preferred = servers.find(s => s.name.toLowerCase().includes("upcloud")) || servers[0];
    const episodeLink = preferred?.id;

    const sourcesUrl = `https://flixhq.to/ajax/episode/sources/${episodeLink}`;
    const response = await axios.get(sourcesUrl);
    console.log('Sources URL Response:', response.data);

    const link = response.data?.link;
    const modifiedLink = link ? `${link}&_debug=true` : null;

    res.json({
      searchQuery,
      title: firstResult.title,
      mediaId: info.id,
      episodeId,
      sourcesUrl,
      modifiedLink,
      sourcesData: response.data,
    });
  } catch (err) {
    console.error("Error in /full:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
