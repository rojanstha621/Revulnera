package enum

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type SubfinderOptions struct {
	BinaryPath string
	Timeout    time.Duration
}

func EnumerateSubdomains(domain string, opts *SubfinderOptions) ([]string, error) {
	domain = strings.TrimSpace(domain)
	if domain == "" {
		return nil, fmt.Errorf("domain is empty")
	}

	bin := "subfinder"
	timeout := 60 * time.Second
	if opts != nil {
		if opts.BinaryPath != "" {
			bin = opts.BinaryPath
		}
		if opts.Timeout > 0 {
			timeout = opts.Timeout
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, bin, "-silent", "-d", domain)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("subfinder timed out after %s", timeout)
		}
		return nil, fmt.Errorf("subfinder error: %w. stderr: %s", err, stderr.String())
	}

	subdomains := make([]string, 0)
	seen := make(map[string]struct{})

	scanner := bufio.NewScanner(&stdout)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		line = strings.ToLower(line)

		if _, exists := seen[line]; !exists {
			seen[line] = struct{}{}
			subdomains = append(subdomains, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("reading subfinder output: %w", err)
	}

	return subdomains, nil
}
