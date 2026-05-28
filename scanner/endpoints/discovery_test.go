package endpoints

import (
	"reflect"
	"testing"
)

func TestDiscoveryTargetsForKatanaPreservesPath(t *testing.T) {
	got := discoveryTargetsForKatana("http://192.168.1.167/mutillidae/")
	want := []string{"http://192.168.1.167/mutillidae/"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected targets: got %v want %v", got, want)
	}
}

func TestDiscoveryTargetsForKatanaTriesBothSchemesForBareTarget(t *testing.T) {
	got := discoveryTargetsForKatana("192.168.1.167/mutillidae/")
	want := []string{"http://192.168.1.167/mutillidae/", "https://192.168.1.167/mutillidae/"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected targets: got %v want %v", got, want)
	}
}

func TestBuildDiscoverySeedsIncludesOriginalTarget(t *testing.T) {
	got := buildDiscoverySeeds("http://192.168.1.167/mutillidae/", []string{"192.168.1.167"})
	want := []string{"http://192.168.1.167/mutillidae/", "192.168.1.167"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected seeds: got %v want %v", got, want)
	}
}

func TestNormalizeAndDeduplicateURLsDropsQueryNoise(t *testing.T) {
	urls := []string{
		"http://localhost/?OLSResponse=v%2BTsG...",
		"http://localhost/?OLSResponse=another-value",
		"http://localhost/mutillidae/?a=1&b=2",
	}

	got := normalizeAndDeduplicateURLs(urls, 10)
	want := []string{"http://localhost/?OLSResponse=", "http://localhost/mutillidae?a=&b="}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected normalized URLs: got %v want %v", got, want)
	}
}
