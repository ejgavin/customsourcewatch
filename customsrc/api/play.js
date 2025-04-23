const { MOVIES } = require('flixhq-core');
const axios = require('axios');
const flixhq = new MOVIES.FlixHQ();

module.exports = async (req, res) => {
  const query = req.query.name || "";
  const season = req.query.season || null;
  const episode = req.query.episode || null;

  try {
    const searchResults = await flixhq.search(query);
    const firstResult = searchResults.results[0];
    if (!firstResult) return res.status(404).json({ error: "No results found." });

    const id = firstResult.id;
    const info = await flixhq.fetchMovieInfo(id);
    let episodeId = null;

    if (season && episode) {
      const episodeInfo = info.episodes.find(e => e.season === parseInt(season) && e.episode === parseInt(episode));
      episodeId = episodeInfo ? episodeInfo.id : null;
    } else {
      episodeId = info.episodes[0]?.id;
    }

    const servers = await flixhq.fetchEpisodeServers(id, episodeId);
    const preferred = servers.find(s => s.name.toLowerCase().includes("upcloud")) || servers[0];
    const episodeLink = preferred?.id;

    const sourcesUrl = `https://flixhq.to/ajax/episode/sources/${episodeLink}`;
    const response = await axios.get(sourcesUrl);
    const link = response.data?.link;
    const modifiedLink = link ? `${link}&_debug=true` : null;

    res.status(200).json({
      searchQuery: query,
      title: firstResult.title,
      modifiedLink,
      episodeId
    });
  } catch (err) {
    console.error("Error in /api/play:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
};
