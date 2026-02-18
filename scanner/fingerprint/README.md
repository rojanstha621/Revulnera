# Technology Fingerprinting

## Overview

This package provides **Wappalyzer-style technology detection** for web applications. It analyzes HTTP responses to identify technologies, frameworks, CMS platforms, libraries, and infrastructure components.

## Features

✅ **Single HTTP Request** - All analysis done from one request per host  
✅ **20KB Body Limit** - Efficient memory usage, reads only first 20KB  
✅ **Pre-compiled Regex** - Patterns compiled at startup for fast matching  
✅ **Confidence Scoring** - Each detection includes confidence percentage  
✅ **Evidence Tracking** - Shows what triggered each detection  
✅ **Extensible** - Easy to add custom signatures via JSON  
✅ **Built-in Signatures** - 30+ technologies detected out of the box  
✅ **Comprehensive Logging** - Detailed logs for debugging and monitoring  

## Quick Start

```go
package main

import (
    "log"
    "net/http"
    "github.com/your-org/scanner/fingerprint"
)

func main() {
    // 1. Get engine instance (singleton)
    engine := fingerprint.GetEngine()
    
    // 2. Load signatures (uses built-in if file not found)
    engine.LoadSignatures("./tech_signatures.json")
    
    // 3. Fetch target
    resp, _ := http.Get("https://example.com")
    defer resp.Body.Close()
    
    // 4. Convert headers
    headers := make(map[string]string)
    for key, values := range resp.Header {
        if len(values) > 0 {
            headers[key] = values[0]
        }
    }
    
    // 5. Extract data (automatically limits to 20KB)
    data, _ := fingerprint.ExtractResponseData(headers, resp.Body)
    
    // 6. Detect technologies
    technologies := engine.DetectTechnologies(data)
    
    // 7. Process results
    for _, tech := range technologies {
        log.Printf("%s (%s) - %d%% confidence", 
            tech.Name, tech.Category, tech.Confidence)
    }
}
```

## Architecture

### Core Types

```go
// Technology signature with regex patterns
type TechSignature struct {
    Name         string   `json:"name"`
    Category     string   `json:"category"`
    HeaderRegex  []string `json:"header_regex"`
    CookieRegex  []string `json:"cookie_regex"`
    BodyRegex    []string `json:"body_regex"`
    ScriptRegex  []string `json:"script_regex"`
    MetaRegex    []string `json:"meta_regex"`
}

// Detection result with confidence
type TechResult struct {
    Name       string   `json:"name"`
    Category   string   `json:"category"`
    Confidence int      `json:"confidence"`
    Evidence   []string `json:"evidence"`
}

// Extracted data from HTTP response
type ExtractedData struct {
    Headers     map[string]string
    Cookies     []string
    Body        string
    ScriptSrcs  []string
    MetaTags    map[string]string
}
```

### Key Functions

**`GetEngine()`** - Returns singleton fingerprint engine  
**`LoadSignatures(filepath)`** - Loads custom signatures from JSON  
**`ExtractResponseData(headers, bodyReader)`** - Extracts fingerprinting data  
**`DetectTechnologies(data)`** - Analyzes data and returns detected technologies  

## Confidence Scoring

Each detection method contributes to confidence score:

| Detection Method | Confidence Points |
|-----------------|-------------------|
| Header Match | +25% |
| Cookie Match | +25% |
| Body Match | +20% |
| Script Source Match | +30% |
| Meta Tag Match | +30% |

**Maximum confidence is capped at 100%**

Multiple matches from the same category only count once (no double-counting).

## Signature Format

Signatures are defined in JSON:

```json
{
  "name": "WordPress",
  "category": "CMS",
  "header_regex": [],
  "cookie_regex": ["wp-settings-", "wordpress_"],
  "body_regex": ["wp-content", "wp-includes"],
  "script_regex": ["wp-content/.*\\.js"],
  "meta_regex": ["WordPress"]
}
```

All regex patterns are case-insensitive by default (`(?i)` flag added automatically).

## Built-in Signatures

The engine includes 30+ built-in technology signatures:

**CMS**: WordPress, Drupal, Joomla  
**Frameworks**: React, Vue.js, Angular, Next.js, Laravel, Django, Rails  
**Servers**: Nginx, Apache  
**Languages**: PHP, Node.js  
**CDN**: Cloudflare, Fastly, Amazon CloudFront  
**Libraries**: jQuery, Bootstrap  
**Tools**: Jenkins, Grafana  
**Analytics**: Google Analytics  
**Payment**: Stripe, PayPal  
**E-commerce**: Shopify, WooCommerce, Magento  
**Build Tools**: Vite, Webpack  

## Custom Signatures

1. Create `tech_signatures.json` file
2. Add your signatures following the format above
3. Load with `engine.LoadSignatures("./tech_signatures.json")`

If the file doesn't exist, built-in signatures are used automatically.

## Performance

- **Memory**: Max 20KB per request (body limit)
- **CPU**: Regex patterns pre-compiled at startup
- **Speed**: ~1-5ms per analysis (depends on signature count)
- **Concurrency**: Thread-safe with RWMutex

## Integration Example

```go
// In your probe/scanner code
func probeEndpoint(url string) (*Result, error) {
    resp, err := httpClient.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // Convert headers
    headers := make(map[string]string)
    for k, v := range resp.Header {
        if len(v) > 0 {
            headers[k] = v[0]
        }
    }
    
    // Get fingerprint engine
    engine := fingerprint.GetEngine()
    
    // Extract and analyze
    data, _ := fingerprint.ExtractResponseData(headers, resp.Body)
    technologies := engine.DetectTechnologies(data)
    
    // Use results
    result := &Result{
        URL:          url,
        StatusCode:   resp.StatusCode,
        Technologies: technologies,
    }
    
    return result, nil
}
```

## Logging

The engine provides detailed logging:

```
[Fingerprint] Loading signatures from: ./tech_signatures.json
[Fingerprint] Compiling 32 technology signatures...
[Fingerprint] Successfully compiled 32 signatures
[Fingerprint] Extracted: 15 headers, 3 cookies, 12 scripts, 5 meta tags, body size: 18432 bytes
[Fingerprint] Analyzing against 32 signatures...
[Fingerprint] Detected: WordPress (Category: CMS, Confidence: 75%)
[Fingerprint] Detected: PHP (Category: Programming Language, Confidence: 50%)
[Fingerprint] Detected: Cloudflare (Category: CDN, Confidence: 50%)
[Fingerprint] Total technologies detected: 3
```

## Best Practices

1. **Initialize Once**: Use `GetEngine()` singleton, don't create multiple instances
2. **Load Early**: Call `LoadSignatures()` at application startup
3. **Reuse Data**: If you need multiple analyses, store the extracted data
4. **Body Limit**: 20KB is usually enough; increase only if necessary
5. **Custom Signatures**: Start with built-in, add custom only for specific needs
6. **Confidence Threshold**: Filter results by confidence (e.g., only show >50%)

## Original Functions (Preserved)

The package also includes the original lightweight fingerprinting functions:

- `FingerprintDomain(headers, body)` - Domain-level detection
- `FingerprintEndpoint(status, title, headers)` - Endpoint-level detection

These can be used alongside the new Wappalyzer-style detection.

## License

Part of the Revulnera security scanner project.
