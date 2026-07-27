package httpclient

import (
	"context"
	"encoding/base64"
	"io"
	"net/http"
	neturl "net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"primrose/internal/collection"
)

// Response is what the frontend renders in the response pane.
// Text bodies arrive in Body; binary bodies (images, …) in BodyBase64.
type Response struct {
	FinalURL string `json:"finalUrl"` // what was actually requested, after resolution
	// RequestHeaders is what actually went over the wire, including the
	// fields the transport adds on its own.
	RequestHeaders map[string]string `json:"requestHeaders"`
	Status         int               `json:"status"`
	StatusText     string            `json:"statusText"`
	Headers        map[string]string `json:"headers"`
	Body           string            `json:"body"`
	BodyBase64     string            `json:"bodyBase64,omitempty"`
	ContentType    string            `json:"contentType"`
	DurationMs     int64             `json:"durationMs"`
	Size           int64             `json:"size"`
}

// captureRequestHeaders returns the headers the request will carry on the
// wire: everything set explicitly plus the fields Go's transport adds
// implicitly (Host, Content-Length, gzip Accept-Encoding).
func captureRequestHeaders(req *http.Request) map[string]string {
	out := make(map[string]string, len(req.Header)+3)
	for k, vals := range req.Header {
		out[k] = strings.Join(vals, ", ")
	}
	out["Host"] = req.Host
	if out["Host"] == "" {
		out["Host"] = req.URL.Host
	}
	if req.ContentLength > 0 {
		out["Content-Length"] = strconv.FormatInt(req.ContentLength, 10)
	}
	if _, ok := out["Accept-Encoding"]; !ok {
		out["Accept-Encoding"] = "gzip"
	}
	return out
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

const (
	// maxBodyBytes caps response bodies (20 MB) so a huge response can't
	// freeze the UI.
	maxBodyBytes = 20 << 20
	// requestTimeout bounds a whole request-response cycle.
	requestTimeout = 30 * time.Second
	// defaultUserAgent identifies primrose instead of Go's stock
	// "Go-http-client"; overridable like any header.
	defaultUserAgent = "primrose/0.1"
)

// Send executes the request as-is (variable resolution happens before this).
// Query params from the map are appended only if their key is not already in
// the URL's query string — the UI keeps both in sync, so this avoids doubles
// while still supporting hand-written files that only use [query].
func Send(r *collection.Request) (*Response, error) {
	return SendCtx(context.Background(), r, nil)
}

// SendCtx is Send with cancellation support and an optional cookie jar
// (session cookies are applied and captured by the client when set).
func SendCtx(ctx context.Context, r *collection.Request, jar http.CookieJar) (*Response, error) {
	client := &http.Client{Timeout: requestTimeout, Jar: jar}
	url := r.URL
	existing := map[string]bool{}
	if i := strings.Index(url, "?"); i != -1 {
		for _, part := range strings.Split(url[i+1:], "&") {
			key, _, _ := strings.Cut(part, "=")
			existing[key] = true
		}
	}
	keys := make([]string, 0, len(r.Query))
	for k := range r.Query {
		if !existing[k] {
			keys = append(keys, k)
		}
	}
	if len(keys) > 0 {
		sort.Strings(keys)
		var params []string
		for _, k := range keys {
			params = append(params, neturl.QueryEscape(k)+"="+neturl.QueryEscape(r.Query[k]))
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

	req, err := http.NewRequestWithContext(ctx, strings.ToUpper(r.Method), url, bodyReader)
	if err != nil {
		return nil, err
	}
	for k, v := range r.Headers {
		req.Header.Set(k, v)
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", defaultUserAgent)
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
	// captured after Do so the jar's Cookie header is included
	sentHeaders := captureRequestHeaders(req)

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
		FinalURL:       url,
		RequestHeaders: sentHeaders,
		Status:         resp.StatusCode,
		StatusText:     http.StatusText(resp.StatusCode),
		Headers:        headers,
		ContentType:    contentType,
		DurationMs:     duration.Milliseconds(),
		Size:           int64(len(bodyBytes)),
	}
	if isTextContentType(contentType) {
		out.Body = string(bodyBytes)
	} else {
		out.BodyBase64 = base64.StdEncoding.EncodeToString(bodyBytes)
	}
	return out, nil
}
