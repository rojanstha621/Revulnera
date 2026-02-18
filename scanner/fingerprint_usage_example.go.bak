package main

import (
	"bytes"
	"io"
	"log"
	"net/http"

	"github.com/your-org/scanner/fingerprint"
)

func main() {
	// Initialize the fingerprint engine (singleton)
	engine := fingerprint.GetEngine()

	// Load signatures from JSON file (or use built-in if file doesn't exist)
	err := engine.LoadSignatures("./tech_signatures.json")
	if err != nil {
		log.Printf("Warning: Could not load signatures: %v", err)
		log.Printf("Using built-in signatures")
	}

	// Example: Fingerprint a website
	exampleURL := "https://example.com"
	
	log.Printf("Fetching: %s", exampleURL)
	resp, err := http.Get(exampleURL)
	if err != nil {
		log.Fatalf("Error fetching URL: %v", err)
	}
	defer resp.Body.Close()

	// Extract headers
	headers := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}

	// Extract data (limits body to 20KB automatically)
	extractedData, err := fingerprint.ExtractResponseData(headers, resp.Body)
	if err != nil {
		log.Fatalf("Error extracting data: %v", err)
	}

	log.Printf("\n=== Extracted Data ===")
	log.Printf("Headers: %d", len(extractedData.Headers))
	log.Printf("Cookies: %d", len(extractedData.Cookies))
	log.Printf("Scripts: %d", len(extractedData.ScriptSrcs))
	log.Printf("Meta tags: %d", len(extractedData.MetaTags))
	log.Printf("Body size: %d bytes", len(extractedData.Body))

	// Detect technologies
	technologies := engine.DetectTechnologies(extractedData)

	log.Printf("\n=== Detected Technologies ===")
	for _, tech := range technologies {
		log.Printf("\nTechnology: %s", tech.Name)
		log.Printf("  Category: %s", tech.Category)
		log.Printf("  Confidence: %d%%", tech.Confidence)
		log.Printf("  Evidence:")
		for _, evidence := range tech.Evidence {
			log.Printf("    - %s", evidence)
		}
	}

	// Example: Using original domain-level fingerprinting
	log.Printf("\n=== Original Domain Fingerprinting ===")
	domainResult := fingerprint.FingerprintDomain(headers, extractedData.Body)
	log.Printf("Tags: %v", domainResult.Tags)
	log.Printf("Evidence: %v", domainResult.Evidence)
}

// Example of integrating with existing code
func fingerprintHost(url string) ([]fingerprint.TechResult, error) {
	// Make HTTP request
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Convert headers
	headers := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}

	// Read body once, store in buffer for reuse
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 20*1024))
	if err != nil {
		return nil, err
	}
	bodyReader := bytes.NewReader(bodyBytes)

	// Extract data
	engine := fingerprint.GetEngine()
	extractedData, err := fingerprint.ExtractResponseData(headers, bodyReader)
	if err != nil {
		return nil, err
	}

	// Detect technologies
	return engine.DetectTechnologies(extractedData), nil
}
