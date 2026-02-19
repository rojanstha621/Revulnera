package network

import (
	"encoding/xml"
	"fmt"
	"log"
	"os/exec"
	"sync"
)

// ============ NMAP XML PARSING STRUCTURES ============

type NmapRun struct {
	XMLName xml.Name `xml:"nmaprun"`
	Hosts   []Host   `xml:"host"`
}

type Host struct {
	Addresses []Address `xml:"address"`
	Ports     Ports     `xml:"ports"`
}

type Address struct {
	Addr string `xml:"addr,attr"`
	Type string `xml:"addrtype,attr"`
}

type Ports struct {
	PortList []Port `xml:"port"`
}

type Port struct {
	Protocol string  `xml:"protocol,attr"`
	PortID   int     `xml:"portid,attr"`
	State    State   `xml:"state"`
	Service  Service `xml:"service"`
}

type State struct {
	State string `xml:"state,attr"`
}

type Service struct {
	Name    string `xml:"name,attr"`
	Product string `xml:"product,attr"`
	Version string `xml:"version,attr"`
	Banner  string `xml:"extrainfo,attr"`
}

// ============ PORT SCAN RESULT ============

type PortFinding struct {
	Host     string   `json:"host"`
	IP       string   `json:"ip"` // Resolved IP address
	Port     int      `json:"port"`
	Protocol string   `json:"protocol"`
	State    string   `json:"state"`
	Service  string   `json:"service"`
	Product  string   `json:"product"`
	Version  string   `json:"version"`
	Banner   string   `json:"banner"`
	RiskTags []string `json:"risk_tags"` // Risk classification tags
}

// ============ PORT SCANNING FUNCTIONS ============

// ScanHostPorts performs Nmap TCP connect scan on a single host
func ScanHostPorts(host string, topPorts int) ([]PortFinding, error) {
	args := []string{
		"-sT", // TCP connect scan (safe, no SYN scan needed)
		"-sV", // Version detection
		fmt.Sprintf("--top-ports=%d", topPorts),
		"-oX", "-", // XML output to stdout
		"--host-timeout", "5m",
		"--max-retries", "1",
		"--version-intensity", "2", // Lighter version probing
		host,
	}

	cmd := exec.Command("nmap", args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("nmap execution failed for %s: %w", host, err)
	}

	var nmapRun NmapRun
	if err := xml.Unmarshal(output, &nmapRun); err != nil {
		return nil, fmt.Errorf("xml parse failed for %s: %w", host, err)
	}

	findings := []PortFinding{}
	for _, h := range nmapRun.Hosts {
		// Extract IP address from Nmap results
		ipAddr := ""
		for _, addr := range h.Addresses {
			if addr.Type == "ipv4" || addr.Type == "ipv6" {
				ipAddr = addr.Addr
				break // Use first IP found
			}
		}

		for _, p := range h.Ports.PortList {
			// Only report open ports
			if p.State.State == "open" {
				findings = append(findings, PortFinding{
					Host:     host, // Use original hostname, not IP
					IP:       ipAddr,
					Port:     p.PortID,
					Protocol: p.Protocol,
					State:    p.State.State,
					Service:  p.Service.Name,
					Product:  p.Service.Product,
					Version:  p.Service.Version,
					Banner:   p.Service.Banner,
					RiskTags: classifyPortRisk(p.PortID, p.Service.Name),
				})
			}
		}
	}

	return findings, nil
}

// ScanHostsConcurrently scans multiple hosts in parallel with worker pool
func ScanHostsConcurrently(hosts []string, workers int, topPorts int) []PortFinding {
	jobs := make(chan string, len(hosts))
	results := make(chan []PortFinding, len(hosts))

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for host := range jobs {
				log.Printf("[nmap] scanning %s (top %d ports)", host, topPorts)
				findings, err := ScanHostPorts(host, topPorts)
				if err != nil {
					log.Printf("[nmap] scan failed for %s: %v", host, err)
					continue
				}
				if len(findings) > 0 {
					log.Printf("[nmap] found %d open ports on %s", len(findings), host)
					results <- findings
				}
			}
		}()
	}

	// Send jobs
	for _, h := range hosts {
		jobs <- h
	}
	close(jobs)

	// Wait and close results
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect all findings
	allFindings := []PortFinding{}
	for findings := range results {
		allFindings = append(allFindings, findings...)
	}

	return allFindings
}

// classifyPortRisk assigns risk tags based on port number and service
func classifyPortRisk(port int, service string) []string {
	tags := []string{}

	// High-risk services that are commonly targeted
	switch port {
	case 21:
		tags = append(tags, "ftp", "cleartext", "file-transfer")
	case 22:
		tags = append(tags, "ssh", "remote-access")
	case 23:
		tags = append(tags, "telnet", "cleartext", "remote-access", "high-risk")
	case 25:
		tags = append(tags, "smtp", "email")
	case 53:
		tags = append(tags, "dns")
	case 80:
		tags = append(tags, "http", "web")
	case 110:
		tags = append(tags, "pop3", "email", "cleartext")
	case 143:
		tags = append(tags, "imap", "email")
	case 443:
		tags = append(tags, "https", "web", "encrypted")
	case 445:
		tags = append(tags, "smb", "file-sharing", "windows")
	case 1433:
		tags = append(tags, "mssql", "database")
	case 3306:
		tags = append(tags, "mysql", "database")
	case 3389:
		tags = append(tags, "rdp", "remote-access", "windows", "high-risk")
	case 5432:
		tags = append(tags, "postgresql", "database")
	case 5900, 5901, 5902:
		tags = append(tags, "vnc", "remote-access", "high-risk")
	case 6379:
		tags = append(tags, "redis", "database")
	case 8080, 8000, 8888:
		tags = append(tags, "http-alt", "web")
	case 27017:
		tags = append(tags, "mongodb", "database")
	case 9200, 9300:
		tags = append(tags, "elasticsearch", "database")
	}

	// Additional service-based classification
	switch service {
	case "ftp":
		if !contains(tags, "ftp") {
			tags = append(tags, "ftp", "file-transfer")
		}
	case "ssh":
		if !contains(tags, "ssh") {
			tags = append(tags, "ssh", "remote-access")
		}
	case "telnet":
		if !contains(tags, "telnet") {
			tags = append(tags, "telnet", "cleartext", "high-risk")
		}
	case "mysql":
		if !contains(tags, "mysql") {
			tags = append(tags, "mysql", "database")
		}
	case "postgresql":
		if !contains(tags, "postgresql") {
			tags = append(tags, "postgresql", "database")
		}
	case "ms-sql-s", "mssql":
		if !contains(tags, "mssql") {
			tags = append(tags, "mssql", "database")
		}
	case "mongodb":
		if !contains(tags, "mongodb") {
			tags = append(tags, "mongodb", "database")
		}
	case "redis":
		if !contains(tags, "redis") {
			tags = append(tags, "redis", "database")
		}
	case "vnc":
		if !contains(tags, "vnc") {
			tags = append(tags, "vnc", "remote-access", "high-risk")
		}
	case "rdp", "ms-wbt-server":
		if !contains(tags, "rdp") {
			tags = append(tags, "rdp", "remote-access", "windows", "high-risk")
		}
	}

	return tags
}

// contains checks if a string slice contains a specific string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
