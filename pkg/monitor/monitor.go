package monitor

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

// RequestMonitor создает middleware для мониторинга запросов в стиле htop
func RequestMonitor() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Создаем wrapper для ResponseWriter чтобы получить статус код
			ww := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			// Выполняем запрос
			next.ServeHTTP(ww, r)

			// Вычисляем время выполнения
			duration := time.Since(start)

			// Форматируем URL (обрезаем если слишком длинный)
			url := r.URL.Path
			if r.URL.RawQuery != "" {
				url += "?" + r.URL.RawQuery
			}
			if len(url) > 60 {
				url = url[:57] + "..."
			}

			// Определяем цвет статуса
			statusColor := getStatusColor(ww.statusCode)
			methodColor := getMethodColor(r.Method)

			// Выводим информацию о запросе
			fmt.Printf("\033[2K\r%s%-6s\033[0m %s%-3d\033[0m │ %-60s │ %6.2fms\n",
				methodColor, r.Method,
				statusColor, ww.statusCode,
				url,
				float64(duration.Nanoseconds())/1000000,
			)
		})
	}
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// getStatusColor возвращает ANSI цвет для статус кода
func getStatusColor(status int) string {
	switch {
	case status >= 200 && status < 300:
		return "\033[32m" // Зеленый
	case status >= 300 && status < 400:
		return "\033[33m" // Желтый
	case status >= 400 && status < 500:
		return "\033[31m" // Красный
	case status >= 500:
		return "\033[35m" // Фиолетовый
	default:
		return "\033[37m" // Белый
	}
}

// getMethodColor возвращает ANSI цвет для HTTP метода
func getMethodColor(method string) string {
	switch strings.ToUpper(method) {
	case "GET":
		return "\033[34m" // Синий
	case "POST":
		return "\033[32m" // Зеленый
	case "PUT":
		return "\033[33m" // Желтый
	case "DELETE":
		return "\033[31m" // Красный
	case "PATCH":
		return "\033[36m" // Циан
	default:
		return "\033[37m" // Белый
	}
}
