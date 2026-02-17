package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"

	endpointspkg "recon/endpoints"
	reconpkg "recon/recon"
)

func main() {
	// Set up logging to both terminal and file
	logFile, err := os.OpenFile("scanner.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("failed to open log file: %v", err)
	}
	defer logFile.Close()

	// Create multi-writer to write to both stdout and file
	multiWriter := io.MultiWriter(os.Stdout, logFile)
	log.SetOutput(multiWriter)

	mux := http.NewServeMux()
	mux.HandleFunc("/jobs", jobHandler)
	mux.HandleFunc("/endpoints", endpointsHandler)
	mux.HandleFunc("/scan", scanHandler)

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
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"scan_id":    job.ScanID,
		"target":     job.Target,
		"subdomains": results,
	})
}

// endpointsHandler: use saved subdomain data to find endpoints.
func endpointsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ScanID int64  `json:"scan_id"`
		Target string `json:"target"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	endpoints, err := endpointspkg.DiscoverEndpointsFromScan(req.ScanID, req.Target)
	if err != nil {
		log.Printf("[endpoints] discovery failed: %v", err)
		http.Error(w, "endpoint discovery failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"scan_id":   req.ScanID,
		"target":    req.Target,
		"endpoints": endpoints,
	})
}
