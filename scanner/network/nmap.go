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
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	State    string `json:"state"`
	Service  string `json:"service"`
	Product  string `json:"product"`
	Version  string `json:"version"`
	Banner   string `json:"banner"`
}

// ============ PORT SCANNING FUNCTIONS ============

// ScanHostPorts performs Nmap TCP connect scan on a single host
func ScanHostPorts(host string, topPorts int) ([]PortFinding, error) {
	args := []string{
		"-sT",                          // TCP connect scan (safe, no SYN scan needed)
		"-sV",                          // Version detection
		fmt.Sprintf("--top-ports=%d", topPorts),
		"-oX", "-",                     // XML output to stdout
		"--host-timeout", "5m",
		"--max-retries", "1",
		"--version-intensity", "2",     // Lighter version probing
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

		for _, p := range h.Ports.PortList {
			// Only report open ports
			if p.State.State == "open" {
				findings = append(findings, PortFinding{
					Host:     host, // Use original hostname, not IP
					Port:     p.PortID,
					Protocol: p.Protocol,
					State:    p.State.State,
					Service:  p.Service.Name,
					Product:  p.Service.Product,
					Version:  p.Service.Version,
					Banner:   p.Service.Banner,
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
