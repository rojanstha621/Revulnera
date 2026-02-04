package network

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// ============ DIRECTORY FINDING STRUCTURE ============

type DirectoryFinding struct {
	Host       string `json:"host"`
	BaseURL    string `json:"base_url"`
	Path       string `json:"path"`
	StatusCode int    `json:"status_code"`
	IssueType  string `json:"issue_type"`
	Evidence   string `json:"evidence"`
}

// ============ SENSITIVE PATHS TO CHECK ============

var sensitivePaths = []string{
	"/.git/",
	"/.git/config",
	"/.env",
	"/backup/",
	"/backups/",
	"/admin/",
	"/uploads/",
	"/server-status",
	"/actuator",
	"/actuator/health",
	"/swagger",
	"/swagger-ui/",
	"/api-docs",
	"/.well-known/",
}

// ============ DIRECTORY CHECKING FUNCTIONS ============

// CheckDirectories scans for exposed directories and sensitive files
func CheckDirectories(host string, hasHTTPS bool) []DirectoryFinding {
	scheme := "http"
	if hasHTTPS {
		scheme = "https"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, host)

	findings := []DirectoryFinding{}
	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Stop after 3 redirects
			if len(via) >= 3 {
				return http.ErrUseLastResponse
			}
			return nil
		},
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	for _, path := range sensitivePaths {
		url := baseURL + path
		finding := checkPath(client, host, baseURL, path, url)
		if finding != nil {
			findings = append(findings, *finding)
		}
	}

	return findings
}

// checkPath checks a single path for issues
func checkPath(client *http.Client, host, baseURL, path, url string) *DirectoryFinding {
	resp, err := client.Get(url)
	if err != nil {
		// Silently skip unreachable paths
		return nil
	}
	defer resp.Body.Close()

	// Only report if path is accessible (200 OK)
	if resp.StatusCode != 200 {
		return nil
	}

	// Read response body (limit to 2KB to avoid memory issues)
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2048))
	if err != nil {
		log.Printf("[directory] failed to read body for %s: %v", url, err)
		return nil
	}

	bodyStr := strings.ToLower(string(body))

	finding := DirectoryFinding{
		Host:       host,
		BaseURL:    baseURL,
		Path:       path,
		StatusCode: resp.StatusCode,
	}

	// Detect directory listing
	if strings.Contains(bodyStr, "index of /") ||
		strings.Contains(bodyStr, "directory listing") ||
		strings.Contains(bodyStr, "<title>index of") ||
		strings.Contains(bodyStr, "parent directory") {
		finding.IssueType = "directory_listing"
		finding.Evidence = "Directory listing detected"
		log.Printf("[directory] %s - directory listing found", url)
		return &finding
	}

	// Detect sensitive file exposure
	if strings.Contains(path, ".git") {
		finding.IssueType = "sensitive_file_exposed"
		finding.Evidence = ".git directory or file is accessible"
		log.Printf("[directory] %s - .git exposed", url)
		return &finding
	}

	if strings.Contains(path, ".env") {
		finding.IssueType = "sensitive_file_exposed"
		finding.Evidence = ".env file is accessible"
		log.Printf("[directory] %s - .env exposed", url)
		return &finding
	}

	if strings.Contains(path, "backup") {
		finding.IssueType = "sensitive_path_accessible"
		finding.Evidence = "Backup directory is accessible"
		log.Printf("[directory] %s - backup path accessible", url)
		return &finding
	}

	if strings.Contains(path, "admin") {
		finding.IssueType = "admin_panel_accessible"
		finding.Evidence = "Admin panel or path is accessible"
		log.Printf("[directory] %s - admin path accessible", url)
		return &finding
	}

	// Generic accessible path
	finding.IssueType = "path_accessible"
	finding.Evidence = fmt.Sprintf("Path %s returned 200 OK", path)
	log.Printf("[directory] %s - accessible (200)", url)
	return &finding
}
