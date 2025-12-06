package subdomains

import (
	"encoding/json"
	"net/http"
	"revulnera/scanner/internal/subdomains/subfinder"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	if domain == "" {
		http.Error(w, "domain is required", http.StatusBadRequest)
		return
	}

	results, err := subfinder.Run(domain)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"domain":     domain,
		"subdomains": results,
	})
}
