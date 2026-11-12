// Package exchange is one request/response round trip as the app performs
// it: inherited headers, variable resolution, the HTTP call, the assertions.
// The app and the screenshot fixture both go through here, so the fixture
// can't drift from what a real send does.
package exchange

import (
	"context"
	"net/http"

	"primrose/internal/collection"
	"primrose/internal/httpclient"
	"primrose/internal/tests"
)

func Do(ctx context.Context, r collection.Request, envVars, dynamicVars, inheritedHeaders map[string]string, jar http.CookieJar) (*httpclient.Response, error) {
	r.Headers = collection.MergeHeaders(inheritedHeaders, r.Headers)
	resolved := collection.Resolve(&r, envVars, dynamicVars)
	resp, err := httpclient.SendCtx(ctx, resolved, jar)
	// assertions run after a successful exchange; the script text was
	// already {{env}}-resolved by collection.Resolve, same as the body
	if err == nil && resp != nil && resolved.Tests.Script != "" {
		resp.Tests = tests.Run(resolved.Tests.Script, tests.Input{
			Status:     resp.Status,
			Headers:    resp.Headers,
			Body:       resp.Body,
			DurationMs: resp.DurationMs,
			Size:       resp.Size,
			URL:        resp.FinalURL,
		})
	}
	return resp, err
}
