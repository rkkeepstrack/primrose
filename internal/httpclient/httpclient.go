package httpclient

import (
	"context"
	"encoding/base64"
	"errors"
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
	// RequestURL is what primrose asked for: the URL after variable
	// resolution and query encoding, before any redirects.
	RequestURL string `json:"requestUrl"`
	// FinalURL is the URL of the request that produced this response —
	// differs from RequestURL when redirects were followed.
	FinalURL string `json:"finalUrl"`
	// Redirects lists the URLs of followed redirect hops, in order. A hop
	// that silently drops the query string is visible here.
	Redirects []string `json:"redirects,omitempty"`
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

// normalizeQuery percent-encodes the URL's query keys and values (an
// already-encoded value stays as it is — unescape-then-escape is
// idempotent). Raw reserved characters like "/" otherwise survive to the
// wire, where e.g. Cloudflare's http→https redirect drops them from the
// Location header.
func normalizeQuery(url string) string {
	i := strings.Index(url, "?")
	if i == -1 {
		return url
	}
	parts := strings.Split(url[i+1:], "&")
	for j, p := range parts {
		k, v, has := strings.Cut(p, "=")
		if !has {
			parts[j] = escapePreserving(k)
			continue
		}
		parts[j] = escapePreserving(k) + "=" + escapePreserving(v)
	}
	return url[:i+1] + strings.Join(parts, "&")
}

func escapePreserving(s string) string {
	u, err := neturl.QueryUnescape(s)
	if err != nil {
		return s // malformed escape — send verbatim rather than corrupt it
	}
	return neturl.QueryEscape(u)
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
	var redirects []string
	client := &http.Client{
		Timeout: requestTimeout,
		Jar:     jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return errors.New("stopped after 10 redirects")
			}
			redirects = append(redirects, req.URL.String())
			return nil
		},
	}
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

	req, err := http.NewRequestWithContext(ctx, strings.ToUpper(r.Method), normalizeQuery(url), bodyReader)
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
		RequestURL:     req.URL.String(),
		FinalURL:       resp.Request.URL.String(),
		Redirects:      redirects,
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
