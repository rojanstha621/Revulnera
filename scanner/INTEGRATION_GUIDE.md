# Integrating Wappalyzer-style Fingerprinting into Scanner

## Overview

This guide shows how to integrate the new fingerprinting engine into your existing scanner workflow.

## Step 1: Initialize at Startup

In your `main.go` or initialization code:

```go
package main

import (
    "log"
    "github.com/your-org/scanner/fingerprint"
)

func main() {
    // Initialize fingerprint engine at startup
    log.Println("Initializing technology fingerprint engine...")
    engine := fingerprint.GetEngine()
    
    // Load signatures (falls back to built-in if file not found)
    if err := engine.LoadSignatures("./tech_signatures.json"); err != nil {
        log.Printf("Warning: Using built-in signatures: %v", err)
    }
    
    // Start your scanner as usual
    startScanner()
}
```

## Step 2: Integration with Probe Module

Enhance your existing `probe` or `httpx` integration to use the new fingerprinting:

```go
// In probe/probe.go or endpoints/endpoints.go

import (
    "bytes"
    "io"
    "net/http"
    "github.com/your-org/scanner/fingerprint"
)

func probeEndpoint(url string) (*EndpointResult, error) {
    // Make HTTP request
    resp, err := httpClient.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // Read body once (20KB limit for fingerprinting)
    bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 20*1024))
    if err != nil {
        return nil, err
    }
    
    // Convert headers to map
    headers := make(map[string]string)
    for key, values := range resp.Header {
        if len(values) > 0 {
            headers[key] = values[0]
        }
    }
    
    // Extract title (your existing code)
    title := extractTitle(string(bodyBytes))
    
    // NEW: Wappalyzer-style fingerprinting
    engine := fingerprint.GetEngine()
    bodyReader := bytes.NewReader(bodyBytes)
    extractedData, _ := fingerprint.ExtractResponseData(headers, bodyReader)
    technologies := engine.DetectTechnologies(extractedData)
    
    // OPTIONAL: Also use original fingerprinting for quick tags
    domainTags := fingerprint.FingerprintDomain(headers, string(bodyBytes))
    
    // Build result
    result := &EndpointResult{
        URL:           url,
        StatusCode:    resp.StatusCode,
        Title:         title,
        ContentLength: len(bodyBytes),
        Headers:       headers,
        Technologies:  technologies,         // NEW: Detailed tech detection
        Tags:          domainTags.Tags,      // ORIGINAL: Quick tags
        Fingerprints:  extractTechNames(technologies), // For backward compatibility
    }
    
    return result, nil
}

// Helper: Extract just technology names for simple arrays
func extractTechNames(technologies []fingerprint.TechResult) []string {
    names := make([]string, 0, len(technologies))
    for _, tech := range technologies {
        names = append(names, tech.Name)
    }
    return names
}
```

## Step 3: Update Data Structures

Update your endpoint data structure to include detailed technology information:

```go
// In your models or data structures

type EndpointResult struct {
    URL           string                       `json:"url"`
    StatusCode    int                          `json:"status_code"`
    Title         string                       `json:"title"`
    ContentLength int                          `json:"content_length"`
    Headers       map[string]string            `json:"headers"`
    
    // NEW: Detailed technology detection
    Technologies  []fingerprint.TechResult     `json:"technologies"`
    
    // ORIGINAL: Keep for backward compatibility
    Fingerprints  []string                     `json:"fingerprints"`
    Tags          []string                     `json:"tags,omitempty"`
}
```

## Step 4: Update Streaming/Ingestion

When sending results to the backend:

```go
func sendEndpointResult(result *EndpointResult) error {
    // Convert to JSON
    payload := map[string]interface{}{
        "url":            result.URL,
        "status_code":    result.StatusCode,
        "title":          result.Title,
        "content_length": result.ContentLength,
        "headers":        result.Headers,
        
        // NEW: Send detailed technology data
        "technologies": result.Technologies,
        
        // ORIGINAL: Keep for backward compatibility
        "fingerprints": result.Fingerprints,
    }
    
    // Send to backend
    return postToBackend(scanID, payload)
}
```

## Step 5: Filtering and Confidence Thresholds

Filter results by confidence level:

```go
// Only keep high-confidence detections
func filterTechnologies(technologies []fingerprint.TechResult, minConfidence int) []fingerprint.TechResult {
    filtered := make([]fingerprint.TechResult, 0)
    for _, tech := range technologies {
        if tech.Confidence >= minConfidence {
            filtered = append(filtered, tech)
        }
    }
    return filtered
}

// Usage
highConfidenceTechs := filterTechnologies(technologies, 50) // 50% minimum
result.Technologies = highConfidenceTechs
```

## Step 6: Logging Integration

The fingerprint engine already logs to stdout. To integrate with your scanner's logging:

```go
import (
    "log"
    "os"
)

func initLogging() {
    // Set up multi-writer for scanner logs
    logFile, _ := os.OpenFile("scanner.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
    multiWriter := io.MultiWriter(os.Stdout, logFile)
    log.SetOutput(multiWriter)
    
    // Fingerprint engine will automatically use this logger
}
```

## Complete Integration Example

```go
package main

import (
    "bytes"
    "io"
    "log"
    "net/http"
    
    "github.com/your-org/scanner/fingerprint"
    "github.com/your-org/scanner/endpoints"
)

func main() {
    // Initialize at startup
    log.Println("Initializing fingerprint engine...")
    engine := fingerprint.GetEngine()
    engine.LoadSignatures("./tech_signatures.json")
    
    // Your existing scanner initialization
    startScanner()
}

func scanEndpoints(urls []string) {
    for _, url := range urls {
        result, err := probeWithFingerprinting(url)
        if err != nil {
            log.Printf("Error probing %s: %v", url, err)
            continue
        }
        
        // Log detected technologies
        log.Printf("[%s] Found %d technologies:", url, len(result.Technologies))
        for _, tech := range result.Technologies {
            log.Printf("  - %s (%s) - %d%% confidence", 
                tech.Name, tech.Category, tech.Confidence)
        }
        
        // Send to backend
        sendToBackend(result)
    }
}

func probeWithFingerprinting(url string) (*EndpointResult, error) {
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // Read body once
    bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 20*1024))
    
    // Prepare headers
    headers := make(map[string]string)
    for k, v := range resp.Header {
        if len(v) > 0 {
            headers[k] = v[0]
        }
    }
    
    // Fingerprint technologies
    engine := fingerprint.GetEngine()
    bodyReader := bytes.NewReader(bodyBytes)
    extractedData, _ := fingerprint.ExtractResponseData(headers, bodyReader)
    technologies := engine.DetectTechnologies(extractedData)
    
    // Filter by confidence
    highConfTechs := make([]fingerprint.TechResult, 0)
    for _, tech := range technologies {
        if tech.Confidence >= 50 {
            highConfTechs = append(highConfTechs, tech)
        }
    }
    
    return &EndpointResult{
        URL:          url,
        StatusCode:   resp.StatusCode,
        Technologies: highConfTechs,
    }, nil
}
```

## Performance Considerations

- **One request per host**: The 20KB limit ensures fast processing
- **Pre-compiled patterns**: Signatures compiled once at startup
- **Thread-safe**: Multiple goroutines can use the engine concurrently
- **Memory efficient**: Max 20KB × concurrent requests

## Backward Compatibility

The new fingerprinting engine works alongside your existing code:

- **Keep existing**: `FingerprintDomain()` and `FingerprintEndpoint()` still work
- **Add new**: Use `DetectTechnologies()` for detailed analysis
- **Combine**: Use both for comprehensive coverage

## Custom Signatures

To add custom technology signatures:

1. Edit `tech_signatures.json`
2. Add your pattern following the format
3. Restart scanner (signatures loaded at startup)

Example custom signature:

```json
{
  "name": "Your Custom Tech",
  "category": "Custom Category",
  "header_regex": ["X-Custom-Header"],
  "cookie_regex": ["custom_session"],
  "body_regex": ["custom-identifier"],
  "script_regex": ["custom\\.js"],
  "meta_regex": ["Custom Generator"]
}
```

## Troubleshooting

**Issue**: Signatures not loading  
**Solution**: Check file path, ensure `tech_signatures.json` exists, check logs

**Issue**: Low confidence scores  
**Solution**: Add more patterns to signatures, check regex accuracy

**Issue**: High memory usage  
**Solution**: 20KB limit is enforced, check concurrent request count

**Issue**: Slow performance  
**Solution**: Reduce signature count, optimize regex patterns

## Next Steps

1. Test with a few URLs first
2. Verify output format matches backend expectations
3. Adjust confidence thresholds based on results
4. Add custom signatures for your specific use cases
5. Monitor logs for any warnings or errors
