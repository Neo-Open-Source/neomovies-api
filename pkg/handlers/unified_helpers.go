package handlers

import (
    "encoding/json"
    "net/http"
    "time"

    "github.com/gorilla/mux"
)

func muxVars(r *http.Request) map[string]string { return mux.Vars(r) }

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v)
}

type metaEnvelope struct {
    FetchedAt    time.Time `json:"fetchedAt"`
    APIVersion   string    `json:"apiVersion"`
    ResponseTime int64     `json:"responseTime"`
}
