package network

import (
	"encoding/xml"
	"testing"
)

func TestParseNmapXML(t *testing.T) {
	sampleXML := `<?xml version="1.0"?>
<nmaprun>
  <host>
    <address addr="192.168.1.1" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="80">
        <state state="open"/>
        <service name="http" product="nginx" version="1.18.0" extrainfo="Ubuntu"/>
      </port>
      <port protocol="tcp" portid="443">
        <state state="open"/>
        <service name="https" product="nginx" version="1.18.0"/>
      </port>
    </ports>
  </host>
</nmaprun>`

	var nmapRun NmapRun
	err := xml.Unmarshal([]byte(sampleXML), &nmapRun)
	if err != nil {
		t.Fatalf("XML parse failed: %v", err)
	}

	if len(nmapRun.Hosts) != 1 {
		t.Errorf("Expected 1 host, got %d", len(nmapRun.Hosts))
	}

	host := nmapRun.Hosts[0]
	if len(host.Ports.PortList) != 2 {
		t.Errorf("Expected 2 ports, got %d", len(host.Ports.PortList))
	}

	port80 := host.Ports.PortList[0]
	if port80.PortID != 80 {
		t.Errorf("Expected port 80, got %d", port80.PortID)
	}

	if port80.Service.Name != "http" {
		t.Errorf("Expected service 'http', got '%s'", port80.Service.Name)
	}

	if port80.Service.Product != "nginx" {
		t.Errorf("Expected product 'nginx', got '%s'", port80.Service.Product)
	}

	if port80.Service.Version != "1.18.0" {
		t.Errorf("Expected version '1.18.0', got '%s'", port80.Service.Version)
	}
}

func TestPortFindingStructure(t *testing.T) {
	finding := PortFinding{
		Host:     "example.com",
		Port:     443,
		Protocol: "tcp",
		State:    "open",
		Service:  "https",
		Product:  "nginx",
		Version:  "1.20.1",
		Banner:   "Ubuntu",
	}

	if finding.Host != "example.com" {
		t.Errorf("Expected host 'example.com', got '%s'", finding.Host)
	}

	if finding.Port != 443 {
		t.Errorf("Expected port 443, got %d", finding.Port)
	}

	if finding.Service != "https" {
		t.Errorf("Expected service 'https', got '%s'", finding.Service)
	}
}
