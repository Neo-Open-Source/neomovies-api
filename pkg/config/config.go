package config

import (
	"log"
	"os"
)

type Config struct {
	MongoURI        string
	TMDBAccessToken string
	JWTSecret       string
	Port            string
	BaseURL         string
	NodeEnv         string
	GmailUser       string
	GmailPassword   string
	LumexURL        string
	AllohaToken     string
}

func New() *Config {
	// Добавляем отладочное логирование для Vercel
	mongoURI := getMongoURI()
	log.Printf("DEBUG: MongoDB URI configured (length: %d)", len(mongoURI))
	
	return &Config{
		MongoURI:        mongoURI,
		TMDBAccessToken: getEnv("TMDB_ACCESS_TOKEN", ""),
		JWTSecret:       getEnv("JWT_SECRET", "your-secret-key"),
		Port:            getEnv("PORT", "3000"),
		BaseURL:         getEnv("BASE_URL", "http://localhost:3000"),
		NodeEnv:         getEnv("NODE_ENV", "development"),
		GmailUser:       getEnv("GMAIL_USER", ""),
		GmailPassword:   getEnv("GMAIL_APP_PASSWORD", ""),
		LumexURL:        getEnv("LUMEX_URL", ""),
		AllohaToken:     getEnv("ALLOHA_TOKEN", ""),
	}
}

// getMongoURI проверяет различные варианты названий переменных для MongoDB URI
func getMongoURI() string {
	// Проверяем различные возможные названия переменных
	envVars := []string{"MONGO_URI", "MONGODB_URI", "DATABASE_URL", "MONGO_URL"}
	
	for _, envVar := range envVars {
		if value := os.Getenv(envVar); value != "" {
			log.Printf("DEBUG: Using %s for MongoDB connection", envVar)
			return value
		}
	}
	
	// Если ни одна переменная не найдена, возвращаем пустую строку
	log.Printf("DEBUG: No MongoDB URI environment variable found")
	return ""
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}