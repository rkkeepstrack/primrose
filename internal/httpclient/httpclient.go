package httpclient

import (
	"encoding/base64"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"primrose/internal/collection"
)

// Response is what the frontend renders in the response pane.
// Text bodies arrive in Body; binary bodies (images, …) in BodyBase64.
type Response struct {
	Status      int               `json:"status"`
	StatusText  string            `json:"statusText"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	BodyBase64  string            `json:"bodyBase64,omitempty"`
	ContentType string            `json:"contentType"`
	DurationMs  int64             `json:"durationMs"`
	Size        int64             `json:"size"`
}

// isTextContentType reports whether a body should be shipped as plain text.
func isTextContentType(ct string) bool {
	ct = strings.ToLower(ct)
	if strings.HasPrefix(ct, "text/") {
		return true
	}
	for _, s := range []string{"json", "xml", "javascript", "x-www-form-urlencoded", "graphql"} {
		if strings.Contains(ct, s) {
			return true
		}
	}
	return ct == "" // no content type: assume text, the UI shows raw
}

const maxBodyBytes = 20 << 20 // 20 MB cap so a huge response can't freeze the UI

var client = &http.Client{Timeout: 30 * time.Second}

// Send executes the request as-is (variable resolution happens before this).
func Send(r *collection.Request) (*Response, error) {
	url := r.URL
	if len(r.Query) > 0 {
		keys := make([]string, 0, len(r.Query))
		for k := range r.Query {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		var params []string
		for _, k := range keys {
			params = append(params, k+"="+r.Query[k])
		}
		sep := "?"
		if strings.Contains(url, "?") {
			sep = "&"
		}
		url += sep + strings.Join(params, "&")
	}

	var bodyReader io.Reader
	if r.Body.Content != "" {
		bodyReader = strings.NewReader(r.Body.Content)
	}

	req, err := http.NewRequest(strings.ToUpper(r.Method), url, bodyReader)
	if err != nil {
		return nil, err
	}
	for k, v := range r.Headers {
		req.Header.Set(k, v)
	}
	if r.Body.Content != "" && req.Header.Get("Content-Type") == "" {
		if r.Body.Type == "json" {
			req.Header.Set("Content-Type", "application/json")
		} else {
			req.Header.Set("Content-Type", "text/plain")
		}
	}

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return nil, err
	}
	duration := time.Since(start)

	headers := make(map[string]string, len(resp.Header))
	for k, vals := range resp.Header {
		headers[k] = strings.Join(vals, ", ")
	}

	contentType := resp.Header.Get("Content-Type")
	out := &Response{
		Status:      resp.StatusCode,
		StatusText:  http.StatusText(resp.StatusCode),
		Headers:     headers,
		ContentType: contentType,
		DurationMs:  duration.Milliseconds(),
		Size:        int64(len(bodyBytes)),
	}
	if isTextContentType(contentType) {
		out.Body = string(bodyBytes)
	} else {
		out.BodyBase64 = base64.StdEncoding.EncodeToString(bodyBytes)
	}
	return out, nil
}
