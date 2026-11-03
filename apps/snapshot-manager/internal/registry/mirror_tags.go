// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"net/http"
	"strings"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/opencontainers/go-digest"
)

const (
	mirrorTagTTL         = 5 * time.Minute
	mirrorTagEntries     = 4096
	manifestsPathSegment = "/manifests/"
	headerContentDigest  = "Docker-Content-Digest"
	headerAccept         = "Accept"
	acceptSeparator      = ","
)

type mirrorTagKey struct {
	repository string
	tag        string
	accept     string
}

type mirrorTags struct {
	digests *expirable.LRU[mirrorTagKey, digest.Digest]
}

func newMirrorTags() *mirrorTags {
	return &mirrorTags{digests: expirable.NewLRU[mirrorTagKey, digest.Digest](mirrorTagEntries, nil, mirrorTagTTL)}
}

func (tags *mirrorTags) handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, cacheable := mirrorTagRequest(r)
		if !cacheable {
			next.ServeHTTP(w, r)
			return
		}
		if resolved, hit := tags.digests.Get(key); hit {
			next.ServeHTTP(w, manifestByDigest(r, key.repository, resolved))
			return
		}
		recorder := &digestRecorder{ResponseWriter: w}
		next.ServeHTTP(recorder, r)
		if recorder.status != http.StatusOK {
			return
		}
		resolved, err := digest.Parse(recorder.Header().Get(headerContentDigest))
		if err == nil {
			tags.digests.Add(key, resolved)
		}
	})
}

func mirrorTagRequest(r *http.Request) (mirrorTagKey, bool) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return mirrorTagKey{}, false
	}
	path, found := strings.CutPrefix(r.URL.Path, registryAPIPrefix+rootPath)
	if !found {
		return mirrorTagKey{}, false
	}
	separator := strings.LastIndex(path, manifestsPathSegment)
	if separator <= 0 {
		return mirrorTagKey{}, false
	}
	repository, reference := path[:separator], path[separator+len(manifestsPathSegment):]
	if reference == "" || strings.Contains(reference, rootPath) {
		return mirrorTagKey{}, false
	}
	if _, err := digest.Parse(reference); err == nil {
		return mirrorTagKey{}, false
	}
	return mirrorTagKey{
		repository: repository,
		tag:        reference,
		accept:     strings.Join(r.Header.Values(headerAccept), acceptSeparator),
	}, true
}

func manifestByDigest(r *http.Request, repository string, resolved digest.Digest) *http.Request {
	rewritten := r.Clone(r.Context())
	rewritten.URL.Path = registryAPIPrefix + rootPath + repository + manifestsPathSegment + resolved.String()
	rewritten.URL.RawPath = ""
	return rewritten
}

type digestRecorder struct {
	http.ResponseWriter
	status int
}

func (recorder *digestRecorder) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func (recorder *digestRecorder) Write(data []byte) (int, error) {
	if recorder.status == 0 {
		recorder.status = http.StatusOK
	}
	return recorder.ResponseWriter.Write(data)
}

func (recorder *digestRecorder) Unwrap() http.ResponseWriter {
	return recorder.ResponseWriter
}
