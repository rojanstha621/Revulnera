package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	reconpkg "recon/recon"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/jobs", jobHandler)

	addr := ":8080"
	if v := os.Getenv("RECON_HTTP_ADDR"); v != "" {
		addr = v
	}

	log.Printf("[recon] starting server on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func jobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var job reconpkg.Job
	if err := json.NewDecoder(r.Body).Decode(&job); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	results, err := reconpkg.HandleJob(job)
	if err != nil {
		log.Printf("[recon] job failed: %v", err)
		http.Error(w, "job failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"scan_id":    job.ScanID,
		"target":     job.Target,
		"subdomains": results,
	}); err != nil {
		log.Printf("[recon] write response error: %v", err)
	}
}
