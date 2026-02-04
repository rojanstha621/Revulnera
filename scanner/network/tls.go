package network

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"time"
)

// ============ TLS RESULT STRUCTURE ============

type TLSResult struct {
	Host              string   `json:"host"`
	HasHTTPS          bool     `json:"has_https"`
	SupportedVersions []string `json:"supported_versions"`
	WeakVersions      []string `json:"weak_versions"`
	CertValid         *bool    `json:"cert_valid,omitempty"`
	CertExpiresAt     string   `json:"cert_expires_at,omitempty"`
	CertIssuer        string   `json:"cert_issuer,omitempty"`
	Issues            []string `json:"issues"`
}

// ============ TLS CHECKING FUNCTIONS ============

// CheckTLS performs comprehensive TLS/SSL analysis on a host
func CheckTLS(host string) TLSResult {
	result := TLSResult{
		Host:              host,
		HasHTTPS:          false,
		SupportedVersions: []string{},
		WeakVersions:      []string{},
		Issues:            []string{},
	}

	addr := fmt.Sprintf("%s:443", host)

	// Check TLS 1.0 (weak)
	if checkTLSVersion(addr, tls.VersionTLS10) {
		result.SupportedVersions = append(result.SupportedVersions, "TLS1.0")
		result.WeakVersions = append(result.WeakVersions, "TLS1.0")
		result.Issues = append(result.Issues, "weak_tls_version_10")
		result.HasHTTPS = true
	}

	// Check TLS 1.1 (weak)
	if checkTLSVersion(addr, tls.VersionTLS11) {
		result.SupportedVersions = append(result.SupportedVersions, "TLS1.1")
		result.WeakVersions = append(result.WeakVersions, "TLS1.1")
		result.Issues = append(result.Issues, "weak_tls_version_11")
		result.HasHTTPS = true
	}

	// Check TLS 1.2 (good)
	if checkTLSVersion(addr, tls.VersionTLS12) {
		result.SupportedVersions = append(result.SupportedVersions, "TLS1.2")
		result.HasHTTPS = true
	}

	// Check TLS 1.3 (best)
	if checkTLSVersion(addr, tls.VersionTLS13) {
		result.SupportedVersions = append(result.SupportedVersions, "TLS1.3")
		result.HasHTTPS = true
	}

	// Get certificate info if HTTPS is available
	if result.HasHTTPS {
		extractCertificateInfo(addr, &result)
	}

	return result
}

// checkTLSVersion tests if a specific TLS version is supported
func checkTLSVersion(addr string, version uint16) bool {
	config := &tls.Config{
		InsecureSkipVerify: true,
		MinVersion:         version,
		MaxVersion:         version,
	}

	dialer := &net.Dialer{Timeout: 5 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, config)
	if err != nil {
		return false
	}
	defer conn.Close()
	return true
}

// extractCertificateInfo retrieves and analyzes the server certificate
func extractCertificateInfo(addr string, result *TLSResult) {
	config := &tls.Config{
		InsecureSkipVerify: true,
	}

	dialer := &net.Dialer{Timeout: 5 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, config)
	if err != nil {
		log.Printf("[tls] failed to connect to %s: %v", addr, err)
		return
	}
	defer conn.Close()

	state := conn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		return
	}

	cert := state.PeerCertificates[0]

	// Set certificate validity
	valid := true
	result.CertValid = &valid
	result.CertExpiresAt = cert.NotAfter.Format(time.RFC3339)
	result.CertIssuer = cert.Issuer.String()

	// Check if certificate is expired
	if time.Now().After(cert.NotAfter) {
		invalid := false
		result.CertValid = &invalid
		result.Issues = append(result.Issues, "certificate_expired")
	} else if time.Until(cert.NotAfter) < 30*24*time.Hour {
		// Certificate expiring within 30 days
		result.Issues = append(result.Issues, "certificate_expiring_soon")
	}

	// Check if certificate is not yet valid
	if time.Now().Before(cert.NotBefore) {
		invalid := false
		result.CertValid = &invalid
		result.Issues = append(result.Issues, "certificate_not_yet_valid")
	}
}
