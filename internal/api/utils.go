package api

import "time"

// formatDate форматирует дату в более читаемый формат
func formatDate(date string) string {
	if date == "" {
		return ""
	}

	// Парсим дату из формата YYYY-MM-DD
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return date
	}

	// Форматируем дату в русском стиле
	months := []string{
		"января", "февраля", "марта", "апреля", "мая", "июня",
		"июля", "августа", "сентября", "октября", "ноября", "декабря",
	}

	return t.Format("2") + " " + months[t.Month()-1] + " " + t.Format("2006")
}
