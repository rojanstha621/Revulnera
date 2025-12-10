package endpoints

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"recon/recon"
)

const (
	defaultWordlistPath = "wordlists/common.txt"
	defaultWorkerCount  = 20
)

type EndpointResult struct {
	URL           string `json:"url"`
	StatusCode    int    `json:"status_code"`
	ContentLength int64  `json:"content_length"`
}

// DiscoverEndpointsFromScan:
//  1) loads subdomains (from data/scan_<id>_<target>.json)
//  2) filters only Alive == true
//  3) builds URLs from schemes + wordlist
//  4) probes them with a worker pool
//  5) saves results to data/endpoints_<id>_<target>.json
func DiscoverEndpointsFromScan(scanID int64, target string) ([]EndpointResult, error) {
	subdomains, scanFile, err := recon.LoadSubdomainsForScan(scanID, target)
	if err != nil {
		return nil, fmt.Errorf("load subdomains: %w", err)
	}
	log.Printf("[endpoints] loaded %d subdomains from %s", len(subdomains), scanFile)

	paths, err := loadWordlist(defaultWordlistPath)
	if err != nil {
		return nil, fmt.Errorf("load wordlist: %w", err)
	}
	log.Printf("[endpoints] loaded %d paths from %s", len(paths), defaultWordlistPath)

	schemes := []string{"http", "https"}

	// Build all URLs to probe
	urls := make([]string, 0)
	for _, s := range subdomains {
		if !s.Alive {
			continue
		}
		for _, scheme := range schemes {
			for _, p := range paths {
				url := fmt.Sprintf("%s://%s%s", scheme, s.Name, p)
				urls = append(urls, url)
			}
		}
	}
	log.Printf("[endpoints] built %d URLs to probe", len(urls))

	results := probeURLsConcurrently(urls, defaultWorkerCount)

	// Save endpoints to file in data/
	if _, err := saveEndpointsToFile(scanID, target, results); err != nil {
		log.Printf("[endpoints] failed to save endpoints for scan_id=%d: %v", scanID, err)
	}

	log.Printf("[endpoints] discovered %d live endpoints for scan_id=%d target=%s",
		len(results), scanID, target)

	return results, nil
}

// loadWordlist reads wordlists/common.txt and returns normalized paths.
// Lines starting with # or empty lines are ignored.
// Paths are normalized to always start with "/".
func loadWordlist(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open wordlist: %w", err)
	}
	defer f.Close()

	var paths []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// normalize to start with "/"
		if !strings.HasPrefix(line, "/") {
			line = "/" + line
		}
		paths = append(paths, line)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read wordlist: %w", err)
	}
	return paths, nil
}

// probeURLsConcurrently runs HTTP GET on all URLs using a worker pool.
func probeURLsConcurrently(urls []string, workerCount int) []EndpointResult {
	if workerCount <= 0 {
		workerCount = 10
	}

	jobs := make(chan string, workerCount*2)
	resultsCh := make(chan EndpointResult, workerCount*2)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	var wg sync.WaitGroup

	// Workers
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for url := range jobs {
				if res, err := probeURL(client, url); err == nil {
					resultsCh <- *res
				}
			}
		}(i)
	}

	// Feed jobs
	go func() {
		for _, url := range urls {
			jobs <- url
		}
		close(jobs)
	}()

	// Close results channel when all workers are done
	go func() {
		wg.Wait()
		close(resultsCh)
	}()

	// Collect results
	results := make([]EndpointResult, 0)
	for res := range resultsCh {
		results = append(results, res)
	}

	return results
}

func probeURL(client *http.Client, url string) (*EndpointResult, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// You can filter here (e.g. ignore 404), but for now we keep all.
	return &EndpointResult{
		URL:           url,
		StatusCode:    resp.StatusCode,
		ContentLength: resp.ContentLength,
	}, nil
}

// EndpointsFilePath returns the JSON path for endpoints_<id>_<target>.json
func EndpointsFilePath(scanID int64, target string) string {
	dataDir := "data"
	safeTarget := strings.ReplaceAll(target, "/", "_")
	safeTarget = strings.ReplaceAll(safeTarget, ":", "_")
	filename := fmt.Sprintf("endpoints_%d_%s.json", scanID, safeTarget)
	return filepath.Join(dataDir, filename)
}

// saveEndpointsToFile writes endpoints results into data/endpoints_<id>_<target>.json
func saveEndpointsToFile(scanID int64, target string, eps []EndpointResult) (string, error) {
	dataDir := "data"
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return "", fmt.Errorf("creating data dir: %w", err)
	}

	path := EndpointsFilePath(scanID, target)

	payload := struct {
		ScanID    int64            `json:"scan_id"`
		Target    string           `json:"target"`
		Endpoints []EndpointResult `json:"endpoints"`
		SavedAt   time.Time        `json:"saved_at"`
	}{
		ScanID:    scanID,
		Target:    target,
		Endpoints: eps,
		SavedAt:   time.Now().UTC(),
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

	log.Printf("[endpoints] saved %d endpoints to %s", len(eps), path)
	return path, nil
}
