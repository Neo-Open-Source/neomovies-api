package handlers

import (
    "fmt"
    "io"
    "net/http"
    "net/url"
    "os"
    "path/filepath"
    "strings"
    "time"

    "github.com/gorilla/mux"
    "neomovies-api/pkg/config"
)

type ImagesHandler struct{}

func NewImagesHandler() *ImagesHandler { return &ImagesHandler{} }

func (h *ImagesHandler) GetImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	size := vars["size"]
	imagePath := vars["path"]

	if size == "" || imagePath == "" {
		http.Error(w, "Size and path are required", http.StatusBadRequest)
		return
	}

    // Попробуем декодировать путь заранее (на фронте абсолютные URL передаются как encodeURIComponent)
    decodedPath := imagePath
    if dp, err := url.QueryUnescape(imagePath); err == nil {
        decodedPath = dp
    }

    if imagePath == "placeholder.jpg" || decodedPath == "placeholder.jpg" {
		h.servePlaceholder(w, r)
		return
	}

	validSizes := []string{"w92", "w154", "w185", "w342", "w500", "w780", "original"}
	if !h.isValidSize(size, validSizes) {
		size = "original"
	}

    var imageURL string
    // Нормализуем абсолютные ссылки вида "https:/..." → "https://...", а также "//..." → "https://..."
    normalized := decodedPath
    if strings.HasPrefix(normalized, "//") {
        normalized = "https:" + normalized
    }
    if strings.HasPrefix(normalized, "http:/") && !strings.HasPrefix(normalized, "http://") {
        normalized = strings.Replace(normalized, "http:/", "http://", 1)
    }
    if strings.HasPrefix(normalized, "https:/") && !strings.HasPrefix(normalized, "https://") {
        normalized = strings.Replace(normalized, "https:/", "https://", 1)
    }

    if strings.HasPrefix(normalized, "http://") || strings.HasPrefix(normalized, "https://") {
        // Проксируем внешний абсолютный URL (например, Kinopoisk)
        imageURL = normalized
    } else {
        // TMDB относительный путь
        imageURL = fmt.Sprintf("%s/%s/%s", config.TMDBImageBaseURL, size, imagePath)
    }

    client := &http.Client{Timeout: 12 * time.Second}

    // Подготовим несколько вариантов заголовков для обхода ограничений источников
    buildRequest := func(targetURL string, attempt int) (*http.Request, error) {
        req, err := http.NewRequest("GET", targetURL, nil)
        if err != nil {
            return nil, err
        }
        // Универсальные заголовки как у браузера
        req.Header.Set("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
        req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7")
        if ua := r.Header.Get("User-Agent"); ua != "" {
            req.Header.Set("User-Agent", ua)
        } else {
            req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36")
        }

        // Настройка Referer: для Yandex/Kinopoisk ставим kinopoisk.ru, иначе — origin URL
        parsed, _ := url.Parse(targetURL)
        host := strings.ToLower(parsed.Host)
        switch attempt {
        case 0:
            if strings.Contains(host, "kinopoisk") || strings.Contains(host, "yandex") {
                req.Header.Set("Referer", "https://www.kinopoisk.ru/")
            } else if parsed.Scheme != "" && parsed.Host != "" {
                req.Header.Set("Referer", parsed.Scheme+"://"+parsed.Host+"/")
            }
        case 1:
            // Без Referer
        default:
            // Оставляем как есть
        }

        return req, nil
    }

    // До 2-х попыток: с реферером источника и без реферера
    var resp *http.Response
    var err error
    for attempt := 0; attempt < 2; attempt++ {
        var req *http.Request
        req, err = buildRequest(imageURL, attempt)
        if err != nil {
            continue
        }
        resp, err = client.Do(req)
        if err == nil && resp != nil && resp.StatusCode == http.StatusOK {
            break
        }
        if resp != nil {
            resp.Body.Close()
        }
    }
	if err != nil {
		h.servePlaceholder(w, r)
		return
	}
    defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		h.servePlaceholder(w, r)
		return
	}

	if contentType := resp.Header.Get("Content-Type"); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000")

	_, err = io.Copy(w, resp.Body)
	if err != nil {
		h.servePlaceholder(w, r)
		return
	}
}

func (h *ImagesHandler) servePlaceholder(w http.ResponseWriter, r *http.Request) {
	placeholderPaths := []string{
		"./assets/placeholder.jpg",
		"./public/images/placeholder.jpg",
		"./static/placeholder.jpg",
	}

	var placeholderPath string
	for _, path := range placeholderPaths {
		if _, err := os.Stat(path); err == nil {
			placeholderPath = path
			break
		}
	}

	if placeholderPath == "" {
		h.serveSVGPlaceholder(w, r)
		return
	}

	file, err := os.Open(placeholderPath)
	if err != nil {
		h.serveSVGPlaceholder(w, r)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(placeholderPath))
	switch ext {
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".webp":
		w.Header().Set("Content-Type", "image/webp")
	default:
		w.Header().Set("Content-Type", "image/jpeg")
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")

	_, err = io.Copy(w, file)
	if err != nil {
		h.serveSVGPlaceholder(w, r)
	}
}

func (h *ImagesHandler) serveSVGPlaceholder(w http.ResponseWriter, r *http.Request) {
	svgPlaceholder := `<svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
		<rect width="100%" height="100%" fill="#f0f0f0"/>
		<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#666">
			Изображение не найдено
		</text>
	</svg>`

	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write([]byte(svgPlaceholder))
}

func (h *ImagesHandler) isValidSize(size string, validSizes []string) bool {
	for _, validSize := range validSizes {
		if size == validSize {
			return true
		}
	}
	return false
}
