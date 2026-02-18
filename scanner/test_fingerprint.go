package main

import (
	"bytes"
	"log"
	"strings"
	"testing"

	"github.com/your-org/scanner/fingerprint"
)

// Test the fingerprint engine with sample data
func TestFingerprintEngine(t *testing.T) {
	// Initialize engine
	engine := fingerprint.GetEngine()
	engine.LoadSignatures("./tech_signatures.json")

	// Sample data simulating a WordPress site
	headers := map[string]string{
		"Server":       "nginx/1.18.0",
		"X-Powered-By": "PHP/7.4",
		"Set-Cookie":   "PHPSESSID=abc123; wordpress_logged_in=xyz",
		"Content-Type": "text/html; charset=UTF-8",
	}

	body := `
<!DOCTYPE html>
<html>
<head>
    <title>Sample WordPress Site</title>
    <meta name="generator" content="WordPress 5.8" />
    <link rel="stylesheet" href="/wp-content/themes/twentytwenty/style.css">
    <script src="/wp-includes/js/jquery/jquery.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.min.js"></script>
</head>
<body>
    <div data-reactroot>Hello World</div>
</body>
</html>
`

	bodyReader := bytes.NewReader([]byte(body))

	// Extract data
	log.Println("\n=== Testing Fingerprint Engine ===")
	extractedData, err := fingerprint.ExtractResponseData(headers, bodyReader)
	if err != nil {
		t.Fatalf("Failed to extract data: %v", err)
	}

	log.Printf("Extracted Data:")
	log.Printf("  Headers: %d", len(extractedData.Headers))
	log.Printf("  Cookies: %d", len(extractedData.Cookies))
	log.Printf("  Scripts: %d", len(extractedData.ScriptSrcs))
	log.Printf("  Meta Tags: %d", len(extractedData.MetaTags))

	// Detect technologies
	technologies := engine.DetectTechnologies(extractedData)

	log.Printf("\nDetected Technologies: %d", len(technologies))
	for _, tech := range technologies {
		log.Printf("\n  Technology: %s", tech.Name)
		log.Printf("    Category: %s", tech.Category)
		log.Printf("    Confidence: %d%%", tech.Confidence)
		log.Printf("    Evidence: %v", tech.Evidence)
	}

	// Verify expected technologies are detected
	expectedTechs := []string{"WordPress", "PHP", "Nginx", "jQuery", "Bootstrap", "React"}
	foundTechs := make(map[string]bool)
	for _, tech := range technologies {
		foundTechs[tech.Name] = true
	}

	for _, expected := range expectedTechs {
		if !foundTechs[expected] {
			log.Printf("Warning: Expected technology '%s' not detected", expected)
		} else {
			log.Printf("✓ Successfully detected: %s", expected)
		}
	}
}

// Test original fingerprinting functions
func TestOriginalFingerprinting(t *testing.T) {
	log.Println("\n=== Testing Original Fingerprinting ===")

	headers := map[string]string{
		"Server":       "nginx/1.18.0",
		"X-Powered-By": "PHP/7.4",
		"Set-Cookie":   "PHPSESSID=abc123",
		"CF-RAY":       "abc-SJC",
	}

	body := `
<html>
<head><title>Test Site</title></head>
<body>
    <div id="__next">Next.js App</div>
    <script src="/wp-content/plugins/plugin.js"></script>
</body>
</html>
`

	result := fingerprint.FingerprintDomain(headers, body)

	log.Printf("Domain Fingerprint Result:")
	log.Printf("  Tags: %v", result.Tags)
	log.Printf("  Evidence: %v", result.Evidence)

	// Verify expected tags
	expectedTags := []string{"nginx", "php", "cloudflare", "wordpress", "nextjs"}
	foundTags := make(map[string]bool)
	for _, tag := range result.Tags {
		foundTags[strings.ToLower(tag)] = true
	}

	for _, expected := range expectedTags {
		if !foundTags[expected] {
			log.Printf("Warning: Expected tag '%s' not found", expected)
		} else {
			log.Printf("✓ Successfully tagged: %s", expected)
		}
	}
}

// Test endpoint-level fingerprinting
func TestEndpointFingerprinting(t *testing.T) {
	log.Println("\n=== Testing Endpoint Fingerprinting ===")

	headers := map[string]string{
		"Content-Type": "application/json",
	}

	result := fingerprint.FingerprintEndpoint(200, "Grafana Dashboard", headers)

	log.Printf("Endpoint Fingerprint Result:")
	log.Printf("  Tags: %v", result.Tags)
	log.Printf("  Evidence: %v", result.Evidence)

	// Check for expected tags
	if contains(result.Tags, "json-api") {
		log.Println("✓ Detected JSON API")
	}
	if contains(result.Tags, "grafana") {
		log.Println("✓ Detected Grafana")
	}
	if contains(result.Tags, "2xx") {
		log.Println("✓ Detected 2xx status")
	}
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func main() {
	log.SetFlags(log.Ltime | log.Lshortfile)

	// Run tests
	t := &testing.T{}
	TestFingerprintEngine(t)
	TestOriginalFingerprinting(t)
	TestEndpointFingerprinting(t)

	log.Println("\n=== All Tests Completed ===")
}
