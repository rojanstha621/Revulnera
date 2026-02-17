package recon

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"recon/enum"
	"recon/probe"
)

type Job struct {
	ScanID   int64                 `json:"scan_id"`
	Target   string                `json:"target"`
	Workers  int                   `json:"workers"` // Optional: number of concurrent workers
	Callback func(SubdomainResult) `json:"-"`       // Optional: callback for streaming results
}

type SubdomainResult struct {
	Name     string   `json:"name"`
	IP       string   `json:"ip"`  // Primary IP (first one) for backward compatibility
	IPs      []string `json:"ips"` // All resolved IPs
	Alive    bool     `json:"alive"`
	ErrorMsg string   `json:"error_msg"` // Error details if any
}

// ScanFilePath returns the JSON path for a given scan_id + target.
func ScanFilePath(scanID int64, target string) string {
	dataDir := "data"

	safeTarget := strings.ReplaceAll(target, "/", "_")
	safeTarget = strings.ReplaceAll(safeTarget, ":", "_")

	filename := fmt.Sprintf("scan_%d_%s.json", scanID, safeTarget)
	return filepath.Join(dataDir, filename)
}

// HandleJob: enum + liveness + save to file.
// Now uses concurrent probing with worker pool.
func HandleJob(job Job) ([]SubdomainResult, error) {
	log.Printf("[recon] starting job: scan_id=%d target=%s", job.ScanID, job.Target)

	// Enumerate subdomains
	subdomains, err := enum.EnumerateSubdomains(job.Target, &enum.SubfinderOptions{
		BinaryPath: "subfinder",
		Timeout:    120 * time.Second,
	})
	if err != nil {
		log.Printf("[recon] subfinder error for %s: %v", job.Target, err)
		return nil, err
	}

	log.Printf("[recon] found %d subdomains, starting concurrent probing", len(subdomains))

	// Configure probe options
	workers := 10
	if job.Workers > 0 {
		workers = job.Workers
	}

	opts := &probe.ProbeOptions{
		Workers:      workers,
		HTTPTimeout:  10 * time.Second,
		DNSTimeout:   5 * time.Second,
		UseHttpx:     true,
		HttpxBinary:  "httpx",
		HttpxTimeout: 5,
	}

	// Probe all hosts concurrently with streaming callback
	results := make([]SubdomainResult, 0, len(subdomains))
	aliveCount := 0
	var resultsMutex sync.Mutex

	// Create callback for immediate streaming
	streamCallback := func(check probe.HostCheck) {
		primaryIP := ""
		if len(check.IPs) > 0 {
			primaryIP = check.IPs[0]
		}

		// Ensure ips is always an array, never null
		ips := check.IPs
		if ips == nil {
			ips = []string{}
		}

		result := SubdomainResult{
			Name:     check.Host,
			IP:       primaryIP,
			IPs:      ips,
			Alive:    check.Alive,
			ErrorMsg: check.ErrorMsg,
		}

		// Thread-safe result storage
		resultsMutex.Lock()
		results = append(results, result)
		if check.Alive {
			aliveCount++
		}
		resultsMutex.Unlock()

		// Call user-provided callback immediately (for real-time updates)
		if job.Callback != nil {
			job.Callback(result)
		}
	}

	// Probe all hosts with streaming
	probe.ProbeHostsWithCallback(subdomains, opts, streamCallback)

	log.Printf("[recon] probing complete: %d alive out of %d subdomains", aliveCount, len(results))

	if _, err := SaveSubdomainsToFile(job, results); err != nil {
		log.Printf("[recon] failed to save results for scan_id=%d: %v", job.ScanID, err)
	}

	log.Printf("[recon] job finished: scan_id=%d target=%s subdomains=%d alive=%d",
		job.ScanID, job.Target, len(results), aliveCount)

	return results, nil
}

// SaveSubdomainsToFile writes the results as JSON to data/scan_<id>_<target>.json
func SaveSubdomainsToFile(job Job, subs []SubdomainResult) (string, error) {
	dataDir := "data"
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return "", fmt.Errorf("creating data dir: %w", err)
	}

	path := ScanFilePath(job.ScanID, job.Target)

	payload := struct {
		ScanID     int64             `json:"scan_id"`
		Target     string            `json:"target"`
		Subdomains []SubdomainResult `json:"subdomains"`
		SavedAt    time.Time         `json:"saved_at"`
	}{
		ScanID:     job.ScanID,
		Target:     job.Target,
		Subdomains: subs,
		SavedAt:    time.Now().UTC(),
	}

	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(&payload); err != nil {
		return "", fmt.Errorf("encode json: %w", err)
	}

	log.Printf("[recon] saved %d subdomains to %s", len(subs), path)
	return path, nil
}

// LoadSubdomainsFromFile reads a JSON file and returns subdomains.
func LoadSubdomainsFromFile(path string) ([]SubdomainResult, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	var payload struct {
		ScanID     int64             `json:"scan_id"`
		Target     string            `json:"target"`
		Subdomains []SubdomainResult `json:"subdomains"`
		SavedAt    time.Time         `json:"saved_at"`
	}

	if err := json.NewDecoder(f).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode json: %w", err)
	}

	return payload.Subdomains, nil
}

// LoadSubdomainsForScan uses scan_id + target to compute the file path.
func LoadSubdomainsForScan(scanID int64, target string) ([]SubdomainResult, string, error) {
	path := ScanFilePath(scanID, target)
	subs, err := LoadSubdomainsFromFile(path)
	if err != nil {
		return nil, "", err
	}
	return subs, path, nil
}
