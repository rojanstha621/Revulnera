package recon

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"recon/enum"
	"recon/probe"
)

type Job struct {
	ScanID int64  `json:"scan_id"`
	Target string `json:"target"`
}

type SubdomainResult struct {
	Name  string `json:"name"`
	IP    string `json:"ip"`
	Alive bool   `json:"alive"`
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
func HandleJob(job Job) ([]SubdomainResult, error) {
	log.Printf("[recon] starting job: scan_id=%d target=%s", job.ScanID, job.Target)

	subdomains, err := enum.EnumerateSubdomains(job.Target, &enum.SubfinderOptions{
		BinaryPath: "subfinder",
		Timeout:    120 * time.Second,
	})
	if err != nil {
		log.Printf("[recon] subfinder error for %s: %v", job.Target, err)
		return nil, err
	}

	results := make([]SubdomainResult, 0, len(subdomains))
	for _, s := range subdomains {
		check := probe.CheckHost(s)
		results = append(results, SubdomainResult{
			Name:  s,
			IP:    check.IP,
			Alive: check.Alive,
		})
	}

	if _, err := SaveSubdomainsToFile(job, results); err != nil {
		log.Printf("[recon] failed to save results for scan_id=%d: %v", job.ScanID, err)
	}

	log.Printf("[recon] job finished: scan_id=%d target=%s subdomains=%d",
		job.ScanID, job.Target, len(results))

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
