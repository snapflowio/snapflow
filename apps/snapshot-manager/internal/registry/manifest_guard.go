// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/distribution/distribution/v3/registry/api/errcode"
	"github.com/opencontainers/go-digest"
)

const maximumManifestBytes = 4 << 20

var contentAddressedRepository = regexp.MustCompile(`(?:^|/)snapflow-([a-f0-9]{64})$`)

func guardContentAddressedManifests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expected, guarded := contentAddressedManifestPut(r)
		if !guarded {
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maximumManifestBytes))
		if err != nil {
			serveDenied(logger, w, r, fmt.Sprintf("manifest unreadable: %v", err))
			return
		}
		if actual := digest.FromBytes(body); actual != expected {
			serveDenied(logger, w, r, fmt.Sprintf("manifest digest %s does not match repository name %s", actual, expected))
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		r.ContentLength = int64(len(body))
		next.ServeHTTP(w, r)
	})
}

func contentAddressedManifestPut(r *http.Request) (digest.Digest, bool) {
	if r.Method != http.MethodPut {
		return "", false
	}
	path, found := strings.CutPrefix(r.URL.Path, registryAPIPrefix+rootPath)
	if !found {
		return "", false
	}
	separator := strings.LastIndex(path, manifestsPathSegment)
	if separator <= 0 {
		return "", false
	}
	match := contentAddressedRepository.FindStringSubmatch(path[:separator])
	if match == nil {
		return "", false
	}
	return digest.NewDigestFromEncoded(digest.SHA256, match[1]), true
}

func serveDenied(logger *slog.Logger, w http.ResponseWriter, r *http.Request, reason string) {
	logger.WarnContext(r.Context(), "Refused content-addressed manifest push", "path", r.URL.Path, "reason", reason)
	if err := errcode.ServeJSON(w, errcode.ErrorCodeDenied.WithMessage(reason)); err != nil {
		logger.WarnContext(r.Context(), "Failed to write registry error", "error", err)
	}
}
