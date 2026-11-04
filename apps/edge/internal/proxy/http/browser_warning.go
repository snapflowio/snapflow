// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const (
	previewWarningAcceptPath  = "/accept-snapflow-preview-warning"
	previewWarningCookieName  = "__Host-Snapflow-Preview-Accepted"
	previewWarningCookieAge   = 24 * time.Hour
	previewWarningAccepted    = "true"
	contentSecurityPolicy     = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors *"
	noSniffContentTypeOptions = "nosniff"
	navigateFetchMode         = "navigate"
	htmlMediaType             = "text/html"
)

const previewWarningPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Snapflow Preview Warning</title><style>
:root{color-scheme:dark}body{font:16px system-ui,sans-serif;background:#0a0a0a;color:#fff;margin:0;min-height:100vh;display:grid;place-items:center}
main{max-width:38rem;margin:2rem;padding:2.5rem;border:1px solid #333;border-radius:12px;background:#171717}h1{margin-top:0}p{line-height:1.6;color:#ddd}
button{border:0;border-radius:8px;padding:.9rem 1.4rem;background:#06f;color:#fff;font:inherit;font-weight:600;cursor:pointer}
</style></head><body><main><h1>Preview URL warning</h1><p>You are about to visit <strong>%s</strong>.</p>
<p>This site is served through Snapflow and may contain untrusted user-created content. Continue only if you trust the person who shared it, and avoid entering sensitive information.</p>
<form action="%s" method="post"><button type="submit">I understand, continue</button></form></main></body></html>`

func browserUserAgentMarkers() []string {
	return []string{"chrome/", "chromium/", "firefox/", "safari/", "edg/", "opr/"}
}

func (frontend *Frontend) handleBrowserWarning(
	writer http.ResponseWriter,
	request *http.Request,
	route routes.HTTP,
) bool {
	if !route.Policy.ShowBrowserWarning {
		return false
	}
	if request.URL.Path == previewWarningAcceptPath {
		if request.Method != http.MethodPost {
			writer.Header().Set(web.Allow, http.MethodPost)
			http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
			return true
		}
		if !web.AllowsUnsafeRequest(request, untrustedOrigin) {
			http.Error(writer, "cross-origin warning acceptance is not allowed", http.StatusForbidden)
			return true
		}
		acceptBrowserWarning(writer, request)
		return true
	}
	if !isBrowserNavigation(request) || web.IsWebSocketUpgrade(request) || hasAcceptedBrowserWarning(request) {
		return false
	}
	frontend.serveBrowserWarning(writer, request)
	return true
}

// The acceptance cookie is a __Host- cookie, which no other host can set, and
// the edge strips it from guest responses, so only the edge can record that a
// visitor accepted the warning.
func acceptBrowserWarning(writer http.ResponseWriter, request *http.Request) {
	http.SetCookie(writer, &http.Cookie{
		Name:     previewWarningCookieName,
		Value:    previewWarningAccepted,
		Path:     "/",
		MaxAge:   int(previewWarningCookieAge / time.Second),
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteNoneMode,
	})
	writer.Header().Set(web.CacheControl, web.NoStore)
	http.Redirect(writer, request, sameOriginRedirect(request.URL.Query().Get("redirect")), http.StatusSeeOther)
}

func (frontend *Frontend) serveBrowserWarning(writer http.ResponseWriter, request *http.Request) {
	action := previewWarningAcceptPath + "?redirect=" + url.QueryEscape(sameOriginRedirect(request.URL.RequestURI()))
	host := routes.NormalizeHost(request.Host)
	writer.Header().Set(web.CacheControl, web.NoStore)
	writer.Header().Set(web.CloudflareCacheControl, web.NoStore)
	writer.Header().Set(web.ContentSecurityPolicy, contentSecurityPolicy)
	writer.Header().Set(web.ContentType, htmlContentType)
	writer.Header().Set(web.ContentTypeOptions, noSniffContentTypeOptions)
	writer.WriteHeader(http.StatusOK)
	_, err := io.WriteString(
		writer,
		fmt.Sprintf(previewWarningPage, html.EscapeString(host), html.EscapeString(action)),
	)
	if err != nil {
		frontend.logger.Debug("write browser warning response", "error", err)
	}
}

func hasAcceptedBrowserWarning(request *http.Request) bool {
	for _, cookie := range request.CookiesNamed(previewWarningCookieName) {
		if cookie.Value == previewWarningAccepted {
			return true
		}
	}
	return false
}

func untrustedOrigin(*url.URL) bool {
	return false
}

func isBrowserNavigation(request *http.Request) bool {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(request.Header.Get(web.FetchMode)), navigateFetchMode) {
		return true
	}
	if !strings.Contains(strings.ToLower(request.Header.Get(web.Accept)), htmlMediaType) {
		return false
	}
	userAgent := strings.ToLower(request.UserAgent())
	for _, browser := range browserUserAgentMarkers() {
		if strings.Contains(userAgent, browser) {
			return true
		}
	}
	return false
}

// sameOriginRedirect returns value as a path on the current host, or "/" when
// it is not one. The result is rebuilt from only the parsed path and query, so
// no scheme, host or userinfo in value can reach the Location header, and a
// leading "//" or backslash, which browsers read as another host, is refused.
func sameOriginRedirect(value string) string {
	if len(value) < 2 || value[0] != '/' || value[1] == '/' || value[1] == '\\' || strings.Contains(value, "\\") {
		return "/"
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || parsed.User != nil ||
		!strings.HasPrefix(parsed.Path, "/") || strings.HasPrefix(parsed.Path, "//") {
		return "/"
	}
	return (&url.URL{Path: parsed.Path, RawPath: parsed.RawPath, RawQuery: parsed.RawQuery}).RequestURI()
}
