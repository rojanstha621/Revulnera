package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	endpointspkg "recon/endpoints"
	networkpkg "recon/network"
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
	portIngest := fmt.Sprintf("%s/api/recon/scans/%d/network/ports/ingest/", req.BackendBase, req.ScanID)
	tlsIngest := fmt.Sprintf("%s/api/recon/scans/%d/network/tls/ingest/", req.BackendBase, req.ScanID)
	dirIngest := fmt.Sprintf("%s/api/recon/scans/%d/network/dirs/ingest/", req.BackendBase, req.ScanID)

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

	// 3) Network Analysis - Run port scanning, TLS checks, and directory checks for discovered hosts
	log.Printf("[network] starting network analysis for scan %d", req.ScanID)
	
	// Collect unique hosts from subdomains (alive hosts)
	hosts := make([]string, 0)
	for _, sub := range subs {
		if sub.Alive {
			hosts = append(hosts, sub.Name)
		}
	}

	if len(hosts) == 0 {
		log.Printf("[network] no alive hosts found, skipping network analysis")
	} else {
		log.Printf("[network] analyzing %d hosts", len(hosts))
		
		// Run network analysis concurrently with worker pool
		runNetworkAnalysis(hosts, req.AuthHeader, portIngest, tlsIngest, dirIngest)
	}

	postStatus(req.AuthHeader, statusURL, "COMPLETED", "")
}

func runNetworkAnalysis(hosts []string, authHeader, portIngest, tlsIngest, dirIngest string) {
	workers := 10
	jobs := make(chan string, len(hosts))
	
	// Worker pool for concurrent host scanning
	for i := 0; i < workers; i++ {
		go func() {
			for host := range jobs {
				analyzeHost(host, authHeader, portIngest, tlsIngest, dirIngest)
			}
		}()
	}

	// Send jobs
	for _, host := range hosts {
		jobs <- host
	}
	close(jobs)

	// Wait a bit for workers to finish (simple approach)
	time.Sleep(2 * time.Second)
}

func analyzeHost(host, authHeader, portIngest, tlsIngest, dirIngest string) {
	log.Printf("[network] analyzing host: %s", host)

	// 1) Port Scanning
	portFindings, err := networkpkg.ScanHostPorts(host, 200)
	if err != nil {
		log.Printf("[network] port scan failed for %s: %v", host, err)
	} else if len(portFindings) > 0 {
		log.Printf("[network] found %d open ports on %s", len(portFindings), host)
		
		// Send port findings in chunks of 50
		chunkSize := 50
		for i := 0; i < len(portFindings); i += chunkSize {
			j := i + chunkSize
			if j > len(portFindings) {
				j = len(portFindings)
			}
			postJSON(authHeader, portIngest, map[string]any{
				"items": portFindings[i:j],
			})
		}
	}

	// 2) TLS Check
	tlsResult := networkpkg.CheckTLS(host)
	if tlsResult.HasHTTPS || len(tlsResult.Issues) > 0 {
		log.Printf("[network] TLS check for %s: HTTPS=%v, issues=%d", 
			host, tlsResult.HasHTTPS, len(tlsResult.Issues))
		postJSON(authHeader, tlsIngest, tlsResult)
	}

	// 3) Directory Checks
	dirFindings := networkpkg.CheckDirectories(host, tlsResult.HasHTTPS)
	if len(dirFindings) > 0 {
		log.Printf("[network] found %d directory issues on %s", len(dirFindings), host)
		
		// Send directory findings in chunks of 50
		chunkSize := 50
		for i := 0; i < len(dirFindings); i += chunkSize {
			j := i + chunkSize
			if j > len(dirFindings) {
				j = len(dirFindings)
			}
			postJSON(authHeader, dirIngest, map[string]any{
				"items": dirFindings[i:j],
			})
		}
	}
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
