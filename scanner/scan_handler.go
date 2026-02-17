package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
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
	logURL := fmt.Sprintf("%s/api/recon/scans/%d/logs/", req.BackendBase, req.ScanID)

	postStatus(req.AuthHeader, statusURL, "RUNNING", "")

	// 1) Subdomains with real-time streaming
	log.Printf("[scan] starting subdomain discovery with streaming")
	postLog(req.AuthHeader, logURL, fmt.Sprintf("🔍 Starting subdomain enumeration for %s...", req.Target), "info")

	// Create streaming callback for immediate updates
	subdomainCallback := func(sub reconpkg.SubdomainResult) {
		// Send immediately to backend (single item)
		postJSON(req.AuthHeader, subIngest, map[string]any{
			"items": []reconpkg.SubdomainResult{sub},
		})
		log.Printf("[scan] streamed subdomain: %s (alive=%v)", sub.Name, sub.Alive)
	}

	subs, err := reconpkg.HandleJob(reconpkg.Job{
		ScanID:   req.ScanID,
		Target:   req.Target,
		Callback: subdomainCallback,
	})
	if err != nil {
		postStatus(req.AuthHeader, statusURL, "FAILED", err.Error())
		postLog(req.AuthHeader, logURL, fmt.Sprintf("❌ Subdomain enumeration failed: %v", err), "error")
		return
	}

	log.Printf("[scan] subdomain discovery complete: %d total", len(subs))
	aliveCount := 0
	for _, sub := range subs {
		if sub.Alive {
			aliveCount++
		}
	}
	postLog(req.AuthHeader, logURL, fmt.Sprintf("✅ Subdomain enumeration complete: found %d subdomains (%d alive)", len(subs), aliveCount), "success")

	// 2) Endpoints with real-time streaming
	log.Printf("[scan] starting endpoint discovery with streaming")
	postLog(req.AuthHeader, logURL, "🕷️ Starting endpoint discovery (gau + katana)...", "info")

	// Set log callbacks for progress updates during discovery and probing
	endpointspkg.SetLogCallback(func(message, level string) {
		postLog(req.AuthHeader, logURL, message, level)
	})
	endpointspkg.SetDiscoveryLogCallback(func(message, level string) {
		postLog(req.AuthHeader, logURL, message, level)
	})

	// Create streaming callback for immediate updates
	endpointCallback := func(ep endpointspkg.EndpointResult) {
		// Send immediately to backend (single item)
		postJSON(req.AuthHeader, epIngest, map[string]any{
			"items": []endpointspkg.EndpointResult{ep},
		})
		log.Printf("[scan] streamed endpoint: %s (status=%d)", ep.URL, ep.StatusCode)
	}

	eps, err := endpointspkg.DiscoverEndpointsFromScanWithCallback(req.ScanID, req.Target, endpointCallback)
	if err != nil {
		postStatus(req.AuthHeader, statusURL, "FAILED", err.Error())
		postLog(req.AuthHeader, logURL, fmt.Sprintf("❌ Endpoint discovery failed: %v", err), "error")
		return
	}

	log.Printf("[scan] endpoint discovery complete: %d total", len(eps))
	// Note: Progress log already sent by endpoints package

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
		postLog(req.AuthHeader, logURL, "⚠️ No alive hosts found, skipping network analysis", "warning")
	} else {
		log.Printf("[network] analyzing %d hosts", len(hosts))
		postLog(req.AuthHeader, logURL, fmt.Sprintf("🔬 Starting network analysis for %d hosts...", len(hosts)), "info")

		// Run network analysis concurrently with worker pool
		runNetworkAnalysis(hosts, req.AuthHeader, portIngest, tlsIngest, dirIngest)
		postLog(req.AuthHeader, logURL, fmt.Sprintf("✅ Network analysis complete for %d hosts", len(hosts)), "success")
	}

	postStatus(req.AuthHeader, statusURL, "COMPLETED", "")
	postLog(req.AuthHeader, logURL, "🎉 Scan completed successfully!", "success")
}

func runNetworkAnalysis(hosts []string, authHeader, portIngest, tlsIngest, dirIngest string) {
	workers := 10
	jobs := make(chan string, len(hosts))
	var wg sync.WaitGroup

	// Worker pool for concurrent host scanning
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
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

	// Wait for workers to finish
	wg.Wait()
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

func postLog(authHeader, url, message, level string) {
	body := map[string]any{
		"message":   message,
		"level":     level,
		"timestamp": time.Now().Format(time.RFC3339),
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

	// Log response status
	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[scan] POST %s returned %d: %s", url, resp.StatusCode, string(bodyBytes))
	} else {
		log.Printf("[scan] POST %s succeeded (%d)", url, resp.StatusCode)
	}
}
