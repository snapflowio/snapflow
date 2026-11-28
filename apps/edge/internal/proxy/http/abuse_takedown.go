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

	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const (
	takedownContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
	takedownErrorCode             = "preview_disabled_for_abuse"
)

const takedownPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Disabled for abuse</title><style>
:root{color-scheme:dark}body{font:16px system-ui,sans-serif;background:#0a0a0a;color:#fff;margin:0;min-height:100vh;display:grid;place-items:center}
main{max-width:38rem;margin:2rem;padding:2.5rem;border:1px solid #333;border-radius:12px;background:#171717}h1{margin-top:0}p{line-height:1.6;color:#ddd}code{color:#fff}
</style></head><body><main><h1>This site has been disabled</h1>
<p><strong>%s</strong> is served through Snapflow and was disabled after an abuse report.</p>
<p>Abuse case <code>%s</code>.</p></main></body></html>`

func (frontend *Frontend) serveAbuseTakedown(writer http.ResponseWriter, request *http.Request, route routes.HTTP) bool {
	if route.Policy.AbuseCaseID == "" {
		return false
	}
	writer.Header().Set(web.CacheControl, web.NoStore)
	writer.Header().Set(web.CloudflareCacheControl, web.NoStore)
	writer.Header().Set(web.ContentSecurityPolicy, takedownContentSecurityPolicy)
	writer.Header().Set(web.ContentType, htmlContentType)
	writer.Header().Set(web.ContentTypeOptions, noSniffContentTypeOptions)
	writer.Header().Set(edgeErrorHeader, takedownErrorCode)
	writer.WriteHeader(http.StatusForbidden)
	if request.Method == http.MethodHead {
		return true
	}
	page := fmt.Sprintf(takedownPage,
		html.EscapeString(routes.NormalizeHost(request.Host)), html.EscapeString(route.Policy.AbuseCaseID))
	if _, err := io.WriteString(writer, page); err != nil {
		frontend.logger.Debug("write abuse takedown response", "error", err)
	}
	return true
}
