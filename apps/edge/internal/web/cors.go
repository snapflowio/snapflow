// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package web

import (
	"errors"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/edge/internal/routes"
	"golang.org/x/net/http/httpguts"
)

const (
	maximumRequestedHeaders = 64
	maximumHeaderBytes      = 8 << 10
	preflightMaxAge         = 10 * time.Minute
	accessControlPrefix     = "access-control-"
	requestedHeaderDivider  = ","
)

func allowedMethods() []string {
	return []string{
		http.MethodGet,
		http.MethodHead,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
		http.MethodOptions,
	}
}

func HandleCORSPreflight(
	writer http.ResponseWriter,
	request *http.Request,
	policy routes.HTTPPolicy,
) bool {
	requestedMethod := strings.ToUpper(strings.TrimSpace(
		request.Header.Get(AccessControlRequestMethod),
	))
	if request.Method != http.MethodOptions || requestedMethod == "" {
		return false
	}
	methods := allowedMethods()
	origin, allowed := allowedOrigin(request, policy)
	requestedHeaders, err := requestedHeaders(request)
	if !allowed || !slices.Contains(methods, requestedMethod) || err != nil {
		http.Error(writer, "CORS preflight is not allowed", http.StatusForbidden)
		return true
	}
	header := writer.Header()
	applyAllowHeaders(header, origin, policy.AllowCredentials)
	addVary(header, AccessControlRequestMethod)
	addVary(header, AccessControlRequestHeaders)
	header.Set(AccessControlAllowMethods, strings.Join(methods, ListSeparator))
	if len(requestedHeaders) > 0 {
		header.Set(AccessControlAllowHeaders, strings.Join(requestedHeaders, ListSeparator))
	}
	header.Set(AccessControlMaxAge, durationSeconds(preflightMaxAge))
	header.Set(CacheControl, NoStore)
	writer.WriteHeader(http.StatusNoContent)
	return true
}

func ApplyCORSResponse(
	response *http.Response,
	request *http.Request,
	policy routes.HTTPPolicy,
) error {
	if response == nil {
		return errors.New("machine HTTP upstream returned no response")
	}
	response.Header.Set(CloudflareCacheControl, NoStore)
	StripAccessControlHeaders(response.Header)
	ApplyCORSHeaders(response.Header, request, policy)
	return nil
}

// StripAccessControlHeaders removes CORS headers a guest set, so only the
// edge's route policy decides cross-origin access.
func StripAccessControlHeaders(header http.Header) {
	for name := range header {
		if strings.HasPrefix(strings.ToLower(name), accessControlPrefix) {
			header.Del(name)
		}
	}
}

func ApplyCORSHeaders(
	header http.Header,
	request *http.Request,
	policy routes.HTTPPolicy,
) {
	origin, allowed := allowedOrigin(request, policy)
	if allowed {
		applyAllowHeaders(header, origin, policy.AllowCredentials)
	} else if request.Header.Get(Origin) != "" {
		addVary(header, Origin)
	}
}

func allowedOrigin(
	request *http.Request,
	policy routes.HTTPPolicy,
) (string, bool) {
	origin := strings.TrimSpace(request.Header.Get(Origin))
	if origin == "" {
		return "", false
	}
	return origin, slices.Contains(policy.AllowedOrigins, origin)
}

func requestedHeaders(request *http.Request) ([]string, error) {
	value := request.Header.Get(AccessControlRequestHeaders)
	if len(value) > maximumHeaderBytes {
		return nil, errors.New("machine CORS request headers are too large")
	}
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	seen := make(map[string]struct{})
	for header := range strings.SplitSeq(value, requestedHeaderDivider) {
		header = http.CanonicalHeaderKey(strings.TrimSpace(header))
		if header == "" || !httpguts.ValidHeaderFieldName(header) {
			return nil, errors.New("machine CORS request contains an invalid header name")
		}
		seen[header] = struct{}{}
		if len(seen) > maximumRequestedHeaders {
			return nil, errors.New("machine CORS request contains too many headers")
		}
	}
	result := make([]string, 0, len(seen))
	for header := range seen {
		result = append(result, header)
	}
	sort.Strings(result)
	return result, nil
}

func applyAllowHeaders(header http.Header, origin string, credentials bool) {
	header.Set(AccessControlAllowOrigin, origin)
	addVary(header, Origin)
	if credentials {
		header.Set(AccessControlAllowCredentials, CredentialsAllowed)
	} else {
		header.Del(AccessControlAllowCredentials)
	}
}

func addVary(header http.Header, value string) {
	if ContainsToken(header.Values(Vary), value) {
		return
	}
	header.Add(Vary, value)
}

func durationSeconds(duration time.Duration) string {
	return strconv.FormatInt(int64(duration/time.Second), 10)
}
