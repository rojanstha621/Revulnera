package main

import (
	"fmt"
	"os"
	"os/exec"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: scanner <domain>")
		return
	}

	domain := os.Args[1]
	fmt.Println("Running subdomain scan on:", domain)

	// Run subfinder command
	cmd := exec.Command("subfinder", "-d", domain, "-silent")
	output, err := cmd.Output()
	if err != nil {
		fmt.Println("Error running subfinder:", err)
		return
	}

	fmt.Println(string(output))
}
