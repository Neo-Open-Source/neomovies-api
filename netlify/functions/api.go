//go:build netlify

package main

import (
	"context"
	"net/http"

	handler "neomovies-api/api"

	bridge "github.com/vercel/go-bridge/go/bridge"
)

func main() {
	bridge.Start(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler.Handler(w, r.WithContext(context.Background()))
	}))
}
