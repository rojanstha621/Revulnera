package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	endpointspkg "recon/endpoints"
	reconpkg "recon/recon"
)

type ScanRequest struct {
	ScanID      int64  `json:"scan_id"`
	Target      string `json:"target"`
	BackendBase string `json:"backend_base"` // e.g. http://localhost:8000
	AuthHeader  string `json:"auth_header"`  // pass through (dev)
}

func scanHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	go func() {
		runFullScan(req)
	}()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"scan_id": req.ScanID,
		"target":  req.Target,
	})
}

func runFullScan(req ScanRequest) {
	statusURL := fmt.Sprintf("%s/api/recon/scans/%d/status/", req.BackendBase, req.ScanID)
	subIngest := fmt.Sprintf("%s/api/recon/scans/%d/ingest/subdomains/", req.BackendBase, req.ScanID)
	epIngest := fmt.Sprintf("%s/api/recon/scans/%d/ingest/endpoints/", req.BackendBase, req.ScanID)

	postStatus(req.AuthHeader, statusURL, "RUNNING", "")

	// 1) Subdomains (your existing HandleJob saves to file too; fine)
	subs, err := reconpkg.HandleJob(reconpkg.Job{ScanID: req.ScanID, Target: req.Target})
	if err != nil {
		postStatus(req.AuthHeader, statusURL, "FAILED", err.Error())
		return
	}

	// Send subdomains in chunks
	chunkSize := 50
	for i := 0; i < len(subs); i += chunkSize {
		j := i + chunkSize
		if j > len(subs) {
			j = len(subs)
		}
		postJSON(req.AuthHeader, subIngest, map[string]any{
			"items": subs[i:j],
		})
	}

	// 2) Endpoints (includes filtering + fingerprinting + saves endpoints json)
	eps, err := endpointspkg.DiscoverEndpointsFromScan(req.ScanID, req.Target)
	if err != nil {
		postStatus(req.AuthHeader, statusURL, "FAILED", err.Error())
		return
	}

	// Send endpoints in chunks
	for i := 0; i < len(eps); i += chunkSize {
		j := i + chunkSize
		if j > len(eps) {
			j = len(eps)
		}
		postJSON(req.AuthHeader, epIngest, map[string]any{
			"items": eps[i:j],
		})
	}

	postStatus(req.AuthHeader, statusURL, "COMPLETED", "")
}

func postStatus(authHeader, url, status, errMsg string) {
	body := map[string]any{"status": status}
	if errMsg != "" {
		body["error"] = errMsg
	}
	postJSON(authHeader, url, body)
}

func postJSON(authHeader, url string, payload any) {
	data, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[scan] POST %s failed: %v", url, err)
		return
	}
	defer resp.Body.Close()
}
