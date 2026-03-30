package recon

import (
	"bufio"
	"log"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
)

const (
	gbBytes         = int64(1024 * 1024 * 1024)
	minFreeRAMBytes = 2 * gbBytes
)

// RuntimeConfig captures computed runtime settings for recon worker pools.
type RuntimeConfig struct {
	DetectedCores   int
	GOMAXPROCS      int
	FreeRAMBytes    int64
	FreeRAMGB       float64
	ComputedWorkers int
	MaxWorkers      int
	EnvOverrideUsed bool
}

var (
	runtimeConfigOnce sync.Once
	runtimeConfig     RuntimeConfig
)

// GetRuntimeConfig initializes and returns the process runtime config.
// It detects CPU cores, sets GOMAXPROCS, computes worker count, and applies
// RECON_WORKERS override when valid.
func GetRuntimeConfig() RuntimeConfig {
	runtimeConfigOnce.Do(func() {
		cores := runtime.NumCPU()
		if cores < 1 {
			cores = 1
		}

		runtime.GOMAXPROCS(cores)
		gomaxprocs := runtime.GOMAXPROCS(0)
		freeRAMBytes := getAvailableRAMBytes()
		freeRAMGB := float64(freeRAMBytes) / float64(gbBytes)

		computedWorkers := workerCountFromResources(cores, freeRAMBytes)
		maxWorkers := computedWorkers
		envOverrideUsed := false

		if raw := os.Getenv("RECON_WORKERS"); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil && v > 0 {
				maxWorkers = v
				envOverrideUsed = true
			} else {
				log.Printf("[recon] runtime_config invalid_env_override key=RECON_WORKERS value=%q", raw)
			}
		}

		runtimeConfig = RuntimeConfig{
			DetectedCores:   cores,
			GOMAXPROCS:      gomaxprocs,
			FreeRAMBytes:    freeRAMBytes,
			FreeRAMGB:       freeRAMGB,
			ComputedWorkers: computedWorkers,
			MaxWorkers:      maxWorkers,
			EnvOverrideUsed: envOverrideUsed,
		}

		log.Printf(
			"[recon] runtime_config detected_cores=%d free_ram_gb=%.2f computed_workers=%d max_workers=%d env_override_used=%t gomaxprocs=%d",
			runtimeConfig.DetectedCores,
			runtimeConfig.FreeRAMGB,
			runtimeConfig.ComputedWorkers,
			runtimeConfig.MaxWorkers,
			runtimeConfig.EnvOverrideUsed,
			runtimeConfig.GOMAXPROCS,
		)
	})

	return runtimeConfig
}

func workerCountFromResources(cores int, freeRAMBytes int64) int {
	if cores <= 2 || freeRAMBytes < minFreeRAMBytes {
		return 2
	}

	if cores <= 8 {
		return cores * 2
	}

	if cores <= 15 {
		return cores * 3
	}

	if cores >= 16 {
		return cores * 4
	}

	return 2
}

// getAvailableRAMBytes reads MemAvailable from /proc/meminfo.
// If unavailable, it returns a large value so CPU-based scaling is used.
func getAvailableRAMBytes() int64 {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 1<<62 - 1
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "MemAvailable:") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			break
		}

		kb, parseErr := strconv.ParseInt(fields[1], 10, 64)
		if parseErr != nil {
			break
		}

		return kb * 1024
	}

	return 1<<62 - 1
}
