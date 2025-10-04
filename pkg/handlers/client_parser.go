package handlers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

// GetVidsrcParserPlayer handles Vidsrc.to player with client-side parsing
func (h *PlayersHandler) GetVidsrcParserPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVidsrcParserPlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	imdbId := vars["imdb_id"]
	mediaType := vars["media_type"] // "movie" or "tv"
	
	if imdbId == "" || mediaType == "" {
		http.Error(w, "imdb_id and media_type are required", http.StatusBadRequest)
		return
	}
	
	var embedURL string
	if mediaType == "movie" {
		embedURL = fmt.Sprintf("https://vidsrc.to/embed/movie/%s", imdbId)
	} else if mediaType == "tv" {
		season := r.URL.Query().Get("season")
		episode := r.URL.Query().Get("episode")
		if season == "" || episode == "" {
			http.Error(w, "season and episode are required for TV shows", http.StatusBadRequest)
			return
		}
		embedURL = fmt.Sprintf("https://vidsrc.to/embed/tv/%s/%s/%s", imdbId, season, episode)
	} else {
		http.Error(w, "Invalid media_type. Use 'movie' or 'tv'", http.StatusBadRequest)
		return
	}
	
	log.Printf("Generated Vidsrc embed URL: %s", embedURL)
	
	htmlDoc := generateClientParserHTML(embedURL, "Vidsrc Player")
	
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Vidsrc parser player for %s: %s", mediaType, imdbId)
}

// GetVidlinkParserMoviePlayer handles Vidlink.pro parser for movies
func (h *PlayersHandler) GetVidlinkParserMoviePlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVidlinkParserMoviePlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	imdbId := vars["imdb_id"]
	
	if imdbId == "" {
		http.Error(w, "imdb_id is required", http.StatusBadRequest)
		return
	}
	
	embedURL := fmt.Sprintf("https://vidlink.pro/movie/%s", imdbId)
	
	log.Printf("Generated Vidlink movie embed URL: %s", embedURL)
	
	htmlDoc := generateClientParserHTML(embedURL, "Vidlink Player")
	
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Vidlink parser movie player: %s", imdbId)
}

// GetVidlinkParserTVPlayer handles Vidlink.pro parser for TV shows
func (h *PlayersHandler) GetVidlinkParserTVPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVidlinkParserTVPlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	tmdbId := vars["tmdb_id"]
	
	if tmdbId == "" {
		http.Error(w, "tmdb_id is required", http.StatusBadRequest)
		return
	}
	
	season := r.URL.Query().Get("season")
	episode := r.URL.Query().Get("episode")
	if season == "" || episode == "" {
		http.Error(w, "season and episode are required for TV shows", http.StatusBadRequest)
		return
	}
	
	embedURL := fmt.Sprintf("https://vidlink.pro/tv/%s/%s/%s", tmdbId, season, episode)
	
	log.Printf("Generated Vidlink TV embed URL: %s", embedURL)
	
	htmlDoc := generateClientParserHTML(embedURL, "Vidlink Player")
	
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Vidlink parser TV player: %s S%sE%s", tmdbId, season, episode)
}

func generateClientParserHTML(embedURL, title string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/video.js@8.6.1/dist/video-js.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: #000;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        #status {
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            max-width: 90%%;
            transition: opacity 0.3s;
        }

        #status.success {
            background: rgba(34, 197, 94, 0.9);
        }

        #status.error {
            background: rgba(239, 68, 68, 0.9);
        }

        #loader {
            position: fixed;
            top: 50%%;
            left: 50%%;
            transform: translate(-50%%, -50%%);
            text-align: center;
            z-index: 9999;
        }

        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top: 4px solid #fff;
            border-radius: 50%%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }

        @keyframes spin {
            0%% { transform: rotate(0deg); }
            100%% { transform: rotate(360deg); }
        }

        #loader-text {
            color: #fff;
            font-size: 14px;
        }

        #hidden-iframe {
            position: absolute;
            width: 0;
            height: 0;
            border: 0;
            opacity: 0;
            pointer-events: none;
        }

        #player-container {
            width: 100vw;
            height: 100vh;
            display: none;
        }

        #player-container.active {
            display: block;
        }

        .video-js {
            width: 100%%;
            height: 100%%;
        }

        .vjs-big-play-button {
            left: 50%%;
            top: 50%%;
            transform: translate(-50%%, -50%%);
        }
    </style>
</head>
<body>
    <div id="status">Инициализация плеера...</div>
    
    <div id="loader">
        <div class="spinner"></div>
        <div id="loader-text">Загрузка видео...</div>
    </div>

    <iframe id="hidden-iframe" src="%s" sandbox="allow-scripts allow-same-origin"></iframe>

    <div id="player-container">
        <video id="video-player" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto">
            <p class="vjs-no-js">
                Для воспроизведения видео включите JavaScript или используйте браузер с поддержкой HTML5.
            </p>
        </video>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/video.js@8.6.1/dist/video.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@videojs/http-streaming@3.8.0/dist/videojs-http-streaming.min.js"></script>
    
    <script>
        const status = document.getElementById('status');
        const loader = document.getElementById('loader');
        const playerContainer = document.getElementById('player-container');
        const iframe = document.getElementById('hidden-iframe');
        
        let foundUrls = new Set();
        let player = null;
        let checkTimeout = null;
        
        function updateStatus(message, type = 'info') {
            status.textContent = message;
            status.className = type;
            console.log('[Parser]', message);
        }

        function hideLoader() {
            loader.style.display = 'none';
        }

        function showPlayer(url) {
            if (foundUrls.has(url)) return;
            foundUrls.add(url);
            
            console.log('[Parser] Found stream URL:', url);
            updateStatus('Видео найдено! Запуск...', 'success');
            
            setTimeout(() => {
                hideLoader();
                playerContainer.classList.add('active');
                iframe.style.display = 'none';
                
                if (player) {
                    player.dispose();
                }
                
                player = videojs('video-player', {
                    controls: true,
                    autoplay: true,
                    preload: 'auto',
                    fluid: false,
                    fill: true,
                    responsive: true,
                    html5: {
                        vhs: {
                            overrideNative: true,
                            enableLowInitialPlaylist: true,
                            smoothQualityChange: true,
                            fastQualityChange: true
                        },
                        nativeAudioTracks: false,
                        nativeVideoTracks: false
                    }
                });

                player.src({
                    src: url,
                    type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
                });

                player.ready(function() {
                    updateStatus('Воспроизведение...', 'success');
                    setTimeout(() => {
                        status.style.opacity = '0';
                    }, 3000);
                });

                player.on('error', function(e) {
                    const error = player.error();
                    console.error('[Parser] Player error:', error);
                    updateStatus('Ошибка воспроизведения: ' + (error ? error.message : 'Unknown'), 'error');
                });
            }, 500);
        }

        // Intercept fetch requests from iframe
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            if (typeof url === 'string') {
                if (url.includes('.m3u8') || url.includes('.mp4')) {
                    console.log('[Parser] Intercepted fetch:', url);
                    showPlayer(url);
                }
            }
            return originalFetch.apply(this, args);
        };

        // Monitor iframe network activity using Performance API
        let lastCheck = Date.now();
        function checkPerformance() {
            try {
                const entries = performance.getEntriesByType('resource');
                const newEntries = entries.filter(e => e.startTime > lastCheck);
                
                newEntries.forEach(entry => {
                    const url = entry.name;
                    if (url.includes('.m3u8') || (url.includes('.mp4') && !url.includes('poster'))) {
                        console.log('[Parser] Performance API detected:', url);
                        showPlayer(url);
                    }
                });
                
                lastCheck = Date.now();
            } catch (e) {
                console.error('[Parser] Performance check error:', e);
            }
        }

        // Check performance entries every 500ms
        setInterval(checkPerformance, 500);

        // Listen for messages from iframe (if we can inject script there)
        window.addEventListener('message', function(event) {
            try {
                if (event.data && typeof event.data === 'object') {
                    if (event.data.type === 'stream-url' && event.data.url) {
                        console.log('[Parser] Message from iframe:', event.data.url);
                        showPlayer(event.data.url);
                    }
                }
            } catch (e) {
                console.error('[Parser] Message handler error:', e);
            }
        });

        // Inject monitoring script into iframe (may not work due to CORS)
        iframe.addEventListener('load', function() {
            try {
                console.log('[Parser] Iframe loaded, attempting to inject monitor...');
                updateStatus('Поиск видео...', 'info');
                
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const script = iframeDoc.createElement('script');
                script.textContent = ` + "`" + `
                    (function() {
                        const originalFetch = window.fetch;
                        window.fetch = function(...args) {
                            const url = args[0];
                            if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4'))) {
                                window.parent.postMessage({ type: 'stream-url', url: url }, '*');
                            }
                            return originalFetch.apply(this, args);
                        };

                        const originalOpen = XMLHttpRequest.prototype.open;
                        XMLHttpRequest.prototype.open = function(method, url) {
                            if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4'))) {
                                window.parent.postMessage({ type: 'stream-url', url: url }, '*');
                            }
                            return originalOpen.apply(this, arguments);
                        };
                    })();
                ` + "`" + `;
                iframeDoc.head.appendChild(script);
                console.log('[Parser] Monitor script injected successfully');
            } catch (e) {
                console.warn('[Parser] Could not inject into iframe (CORS):', e.message);
                updateStatus('Мониторинг через Performance API...', 'info');
            }
        });

        // Timeout if nothing found in 30 seconds
        checkTimeout = setTimeout(() => {
            if (foundUrls.size === 0) {
                updateStatus('Не удалось найти видео. Попробуйте обновить страницу.', 'error');
                hideLoader();
                // Fallback: show iframe directly
                iframe.style.width = '100%%';
                iframe.style.height = '100%%';
                iframe.style.opacity = '1';
                iframe.style.pointerEvents = 'auto';
            }
        }, 30000);

        // Cleanup
        window.addEventListener('beforeunload', function() {
            if (player) {
                player.dispose();
            }
            if (checkTimeout) {
                clearTimeout(checkTimeout);
            }
        });

        console.log('[Parser] Client-side parser initialized');
        console.log('[Parser] Target URL: %s');
    </script>
</body>
</html>`, title, embedURL, embedURL)
}
