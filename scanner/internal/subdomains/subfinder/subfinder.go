package subfinder

import (
	"context"

	"github.com/projectdiscovery/subfinder/v2/pkg/options"
	"github.com/projectdiscovery/subfinder/v2/pkg/output"
	"github.com/projectdiscovery/subfinder/v2/pkg/subfinder"
)

func Run(domain string) ([]string, error) {
	opt := &options.Options{
		Domains:        []string{domain},
		Threads:        10,
		Verbose:        false,
		All:            false,
		RemoveWildcard: true,
		Silent:         true,
	}

	engine, err := subfinder.NewSubfinder(opt)
	if err != nil {
		return nil, err
	}

	var results []string

	err = engine.Enumerate(context.Background(), func(result *output.Result) {
		results = append(results, result.Host)
	})

	return results, err
}
