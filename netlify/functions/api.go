package main

import (
	"context"
	"net/http"

	bridge "github.com/vercel/go-bridge/go/bridge"
	handler "neomovies-api/api"
)

func main() {
	bridge.Start(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler.Handler(w, r.WithContext(context.Background()))
	}))
}
