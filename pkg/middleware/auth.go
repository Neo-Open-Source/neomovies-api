package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "userID"

// extractUserIDFromClaims supports multiple claim naming conventions.
// Neo ID tokens contain unified_id (or UnifiedID depending on json tags),
// while legacy NeoMovies tokens used user_id.
func extractUserIDFromClaims(claims jwt.MapClaims) (string, error) {
	if v, ok := claims["unified_id"]; ok {
		if s, ok := v.(string); ok && s != "" {
			return s, nil
		}
	}
	if v, ok := claims["UnifiedID"]; ok {
		if s, ok := v.(string); ok && s != "" {
			return s, nil
		}
	}
	if v, ok := claims["user_id"]; ok {
		if s, ok := v.(string); ok && s != "" {
			return s, nil
		}
	}
	return "", errors.New("user id claim not found")
}

func JWTAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				http.Error(w, "Bearer token required", http.StatusUnauthorized)
				return
			}

			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, "Invalid token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, "Invalid token claims", http.StatusUnauthorized)
				return
			}

			userID, err := extractUserIDFromClaims(claims)
			if err != nil {
				http.Error(w, "Invalid user ID in token", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(UserIDKey).(string)
	return userID, ok
}
