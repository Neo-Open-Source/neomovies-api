const { Router } = require('express');
const fetch = require('node-fetch');
const router = Router();

/**
 * @swagger
 * tags:
 *   name: players
 *   description: Плееры Alloha и Lumex
 */

/**
 * @swagger
 * /players/alloha:
 *   get:
 *     tags: [players]
 *     summary: Получить iframe от Alloha по IMDb ID или TMDB ID
 *     parameters:
 *       - in: query
 *         name: imdb_id
 *         schema:
 *           type: string
 *         description: IMDb ID (например tt0111161)
 *       - in: query
 *         name: tmdb_id
 *         schema:
 *           type: string
 *         description: TMDB ID (числовой)
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/alloha', async (req, res) => {
  try {
    const { imdb_id: imdbId, tmdb_id: tmdbId } = req.query;
    if (!imdbId && !tmdbId) {
      return res.status(400).json({ error: 'imdb_id or tmdb_id query param is required' });
    }

    const token = process.env.ALLOHA_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Server misconfiguration: ALLOHA_TOKEN missing' });
    }

    const idParam = imdbId ? `imdb=${encodeURIComponent(imdbId)}` : `tmdb=${encodeURIComponent(tmdbId)}`;
    const apiUrl = `https://api.alloha.tv/?token=${token}&${idParam}`;
    const apiRes = await fetch(apiUrl);

    if (!apiRes.ok) {
      console.error('Alloha response error', apiRes.status);
      return res.status(apiRes.status).json({ error: 'Failed to fetch from Alloha' });
    }

    const json = await apiRes.json();
    if (json.status !== 'success' || !json.data?.iframe) {
      return res.status(404).json({ error: 'Video not found' });
    }

    let iframeCode = json.data.iframe;
    // If Alloha returns just a URL, wrap it in an iframe
    if (!iframeCode.includes('<')) {
      iframeCode = `<iframe src="${iframeCode}" allowfullscreen style="border:none;width:100%;height:100%"></iframe>`;
    }

    // If iframe markup already provided
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Alloha Player</title><style>html,body{margin:0;height:100%;}</style></head><body>${iframeCode}</body></html>`;
    res.set('Content-Type', 'text/html');
    return res.send(htmlDoc);
  } catch (e) {
    console.error('Alloha route error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /players/lumex:
 *   get:
 *     tags: [players]
 *     summary: Получить URL плеера Lumex
 *     parameters:
 *       - in: query
 *         name: imdb_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/lumex', (req, res) => {
  try {
    const { imdb_id: imdbId } = req.query;
    if (!imdbId) return res.status(400).json({ error: 'imdb_id required' });

    const baseUrl = process.env.LUMEX_URL || process.env.NEXT_PUBLIC_LUMEX_URL;
    if (!baseUrl) return res.status(500).json({ error: 'Server misconfiguration: LUMEX_URL missing' });

    const url = `${baseUrl}?imdb_id=${encodeURIComponent(imdbId)}`;
    const iframe = `<iframe src=\"${url}\" allowfullscreen loading=\"lazy\" style=\"border:none;width:100%;height:100%;\"></iframe>`;
  const htmlDoc = `<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Lumex Player</title><style>html,body{margin:0;height:100%;}</style></head><body>${iframe}</body></html>`;
  res.set('Content-Type', 'text/html');
  res.send(htmlDoc);
  } catch (e) {
    console.error('Lumex route error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
