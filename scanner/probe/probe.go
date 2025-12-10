package probe

import (
	"context"
	"net"
	"time"
)

// Result for a single host.
type HostCheck struct {
	IP    string
	Alive bool
}

// CheckHost resolves a hostname and checks if it's alive on port 80 (HTTP).
func CheckHost(host string) HostCheck {
	res := HostCheck{
		IP:    "",
		Alive: false,
	}

	// 1) DNS resolve
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ips, err := net.DefaultResolver.LookupHost(ctx, host)
	if err != nil || len(ips) == 0 {
		// no DNS -> treat as dead
		return res
	}
	// take first IP
	res.IP = ips[0]

	// 2) TCP connect to port 80 to check liveness
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, "80"), 3*time.Second)
	if err != nil {
		// could not connect -> maybe behind 443 only or blocked, but for now treat as not alive
		return res
	}
	_ = conn.Close()
	res.Alive = true

	return res
}
