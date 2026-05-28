package endpoints

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"

	xhtml "golang.org/x/net/html"
)

type DiscoveryAuthConfig struct {
	AuthType string            `json:"auth_type"`
	LoginURL string            `json:"login_url"`
	Username string            `json:"username"`
	Password string            `json:"password"`
	Headers  map[string]string `json:"auth_headers"`
	Cookies  map[string]string `json:"auth_cookies"`
}

func applyDiscoveryAuth(ctx context.Context, client *http.Client, auth *DiscoveryAuthConfig) error {
	if client == nil || auth == nil {
		return nil
	}

	if client.Jar == nil {
		jar, _ := cookiejar.New(nil)
		client.Jar = jar
	}

	for name, value := range auth.Headers {
		if strings.TrimSpace(name) != "" {
			// Headers are applied at request time; nothing to do here.
			_ = value
		}
	}

	if len(auth.Cookies) > 0 {
		if loginURL, err := url.Parse(auth.LoginURL); err == nil && loginURL.Host != "" {
			cookies := make([]*http.Cookie, 0, len(auth.Cookies))
			for name, value := range auth.Cookies {
				if strings.TrimSpace(name) == "" {
					continue
				}
				cookies = append(cookies, &http.Cookie{Name: name, Value: value, Path: "/"})
			}
			client.Jar.SetCookies(loginURL, cookies)
		}
	}

	if strings.EqualFold(strings.TrimSpace(auth.AuthType), "form") {
		if auth.LoginURL == "" || auth.Username == "" || auth.Password == "" {
			return fmt.Errorf("form login requires login_url, username, and password")
		}
		return performFormLogin(ctx, client, auth.LoginURL, auth.Username, auth.Password, auth.Headers)
	}

	return nil
}

func performFormLogin(ctx context.Context, client *http.Client, loginURL, username, password string, headers map[string]string) error {
	seedReq, err := http.NewRequestWithContext(ctx, http.MethodGet, loginURL, nil)
	if err != nil {
		return err
	}
	seedReq.Header.Set("User-Agent", "RevulneraCrawler/1.0")
	seedReq.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	for key, value := range headers {
		if strings.TrimSpace(key) != "" {
			seedReq.Header.Set(key, value)
		}
	}

	seedResp, err := client.Do(seedReq)
	if err != nil {
		return err
	}
	defer seedResp.Body.Close()

	seedBody, err := io.ReadAll(io.LimitReader(seedResp.Body, 1<<20))
	if err != nil {
		return err
	}

	formAction, hiddenFields := extractLoginFormDetails(loginURL, seedBody)
	if formAction == "" {
		formAction = loginURL
	}

	formData := url.Values{}
	for key, value := range hiddenFields {
		formData.Set(key, value)
	}

	for _, key := range []string{"username", "user", "email", "login"} {
		formData.Set(key, username)
	}
	for _, key := range []string{"password", "pass", "pwd"} {
		formData.Set(key, password)
	}
	formData.Set("Login", "Login")
	formData.Set("login", "Login")

	postReq, err := http.NewRequestWithContext(ctx, http.MethodPost, formAction, bytes.NewBufferString(formData.Encode()))
	if err != nil {
		return err
	}
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postReq.Header.Set("User-Agent", "RevulneraCrawler/1.0")
	postReq.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	postReq.Header.Set("Referer", loginURL)
	for key, value := range headers {
		if strings.TrimSpace(key) != "" {
			postReq.Header.Set(key, value)
		}
	}

	resp, err := client.Do(postReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("login failed with http status %d", resp.StatusCode)
	}
	return nil
}

func extractLoginFormDetails(baseURL string, body []byte) (string, map[string]string) {
	root, err := xhtml.Parse(bytes.NewReader(body))
	if err != nil {
		return baseURL, map[string]string{}
	}

	var formAction string
	hidden := make(map[string]string)
	var walk func(*xhtml.Node)
	walk = func(n *xhtml.Node) {
		if n == nil || formAction != "" {
			return
		}
		if n.Type == xhtml.ElementNode && strings.EqualFold(n.Data, "form") {
			for _, attr := range n.Attr {
				if strings.EqualFold(attr.Key, "action") && strings.TrimSpace(attr.Val) != "" {
					formAction = resolveFormURL(baseURL, attr.Val)
				}
			}
			collectHiddenFields(n, hidden)
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)

	if formAction == "" {
		formAction = baseURL
	}
	return formAction, hidden
}

func collectHiddenFields(node *xhtml.Node, hidden map[string]string) {
	if node == nil {
		return
	}
	if node.Type == xhtml.ElementNode && strings.EqualFold(node.Data, "input") {
		var name, value, inputType string
		for _, attr := range node.Attr {
			switch strings.ToLower(attr.Key) {
			case "name":
				name = attr.Val
			case "value":
				value = attr.Val
			case "type":
				inputType = strings.ToLower(attr.Val)
			}
		}
		if name != "" && (inputType == "hidden" || strings.Contains(strings.ToLower(name), "token")) {
			hidden[name] = value
		}
	}
	for c := node.FirstChild; c != nil; c = c.NextSibling {
		collectHiddenFields(c, hidden)
	}
}

func resolveFormURL(baseURL, raw string) string {
	if raw == "" {
		return baseURL
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	return base.ResolveReference(parsed).String()
}
