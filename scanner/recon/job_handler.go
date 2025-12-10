package recon

import (
	"log"
	"time"

	"recon/enum"
)

type Job struct {
	ScanID int64  `json:"scan_id"`
	Target string `json:"target"`
}

type SubdomainResult struct {
	Name string `json:"name"`
}

func HandleJob(job Job) ([]SubdomainResult, error) {
	log.Printf("[recon] starting job: scan_id=%d target=%s", job.ScanID, job.Target)

	subdomains, err := enum.EnumerateSubdomains(job.Target, &enum.SubfinderOptions{
		BinaryPath: "subfinder",
		Timeout:    120 * time.Second,
	})
	if err != nil {
		log.Printf("[recon] subfinder error for %s: %v", job.Target, err)
		return nil, err
	}

	results := make([]SubdomainResult, 0, len(subdomains))
	for _, s := range subdomains {
		results = append(results, SubdomainResult{Name: s})
	}

	log.Printf("[recon] job finished: scan_id=%d target=%s subdomains=%d",
		job.ScanID, job.Target, len(results))

	return results, nil
}
