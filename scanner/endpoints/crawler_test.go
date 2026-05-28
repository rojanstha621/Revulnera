package endpoints

import (
	"strings"
	"testing"

	"net/url"
)

func TestExtractLinksFromHTMLResolvesRelativeAppLinks(t *testing.T) {
	pageURL, err := url.Parse("http://192.168.1.167/dvwa/")
	if err != nil {
		t.Fatalf("parse page url: %v", err)
	}

	scope := crawlScope{host: "192.168.1.167", pathPrefix: "/dvwa/"}
	body := []byte(`
		<html>
		  <body>
		    <link rel="stylesheet" href="dvwa/css/login.css" />
		    <a href="login.php">Login</a>
		    <a href="https://example.com/outside">Outside</a>
		    <script src="js/app.js"></script>
		    <iframe src="vulnerabilities/xss_r/"></iframe>
		    <form action="vulnerabilities/sqli/" method="get">
		      <input name="id" />
		      <input name="Submit" />
		    </form>
		  </body>
		</html>
	`)

	got := extractLinksFromHTML(pageURL, body, scope)
	wantContains := []string{
		"http://192.168.1.167/dvwa/css/login.css",
		"http://192.168.1.167/dvwa/login.php",
		"http://192.168.1.167/dvwa/js/app.js",
		"http://192.168.1.167/dvwa/vulnerabilities/xss_r",
		"http://192.168.1.167/dvwa/vulnerabilities/sqli?Submit=&id=",
	}

	for _, want := range wantContains {
		found := false
		for _, gotURL := range got {
			if gotURL == want {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("missing expected url %q in %v", want, got)
		}
	}

	for _, gotURL := range got {
		if strings.Contains(gotURL, "example.com") {
			t.Fatalf("external url leaked into scope: %s", gotURL)
		}
	}
}
