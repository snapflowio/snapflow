// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/distribution/distribution/v3/registry/auth"
	"github.com/snapflowio/snapshot-manager/internal/access"
)

const (
	headerContentType = "Content-Type"
	headerRetryAfter  = "Retry-After"
	contentTypeJSON   = "application/json"
)

type uploadStatus struct {
	ID     string        `json:"id"`
	State  state         `json:"state"`
	Error  string        `json:"error,omitempty"`
	Upload *uploadTarget `json:"upload,omitempty"`
}

type uploadTarget struct {
	Endpoint        string `json:"endpoint"`
	Region          string `json:"region"`
	Bucket          string `json:"bucket"`
	Key             string `json:"key"`
	AccessKeyID     string `json:"accessKeyId"`
	SecretAccessKey string `json:"secretAccessKey"`
	SessionToken    string `json:"sessionToken"`
	ExpiresAt       string `json:"expiresAt"`
	PartSizeBytes   int64  `json:"partSizeBytes"`
}

type errorBody struct {
	Error string `json:"error"`
}

func statusOf(current record) uploadStatus {
	return uploadStatus{ID: current.ID, State: current.State, Error: current.Error}
}

func (service *Service) respond(w http.ResponseWriter, r *http.Request, status int, body any) {
	w.Header().Set(headerContentType, contentTypeJSON)
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		service.config.Logger.WarnContext(r.Context(), "Failed to write direct upload response", "error", err)
	}
}

func (service *Service) fail(w http.ResponseWriter, r *http.Request, status int, err error) {
	service.respond(w, r, status, errorBody{Error: err.Error()})
}

func (service *Service) failInternal(w http.ResponseWriter, r *http.Request, err error) {
	service.config.Logger.ErrorContext(r.Context(), "Direct upload request failed", "path", r.URL.Path, "error", err)
	service.fail(w, r, http.StatusInternalServerError, errInternal)
}

func (service *Service) authorize(w http.ResponseWriter, r *http.Request, requested ...auth.Access) (string, bool) {
	grant, err := service.config.Access.Authorized(r, requested...)
	if err == nil {
		return grant.User.Name, true
	}
	if errors.Is(err, access.ErrAccessDenied) {
		service.fail(w, r, http.StatusForbidden, errAccessDenied)
		return "", false
	}
	var challenge auth.Challenge
	if errors.As(err, &challenge) {
		challenge.SetHeaders(r, w)
	}
	service.fail(w, r, http.StatusUnauthorized, errAuthentication)
	return "", false
}

func (service *Service) throttle(w http.ResponseWriter, r *http.Request, wait time.Duration, err error) {
	w.Header().Set(headerRetryAfter, strconv.Itoa(max(1, int(math.Ceil(wait.Seconds())))))
	service.fail(w, r, http.StatusTooManyRequests, err)
}

func (service *Service) allow(w http.ResponseWriter, r *http.Request, limiter *subjectLimiter, subject string) bool {
	wait := limiter.wait(subject)
	if wait > 0 {
		service.throttle(w, r, wait, errRateLimited)
		return false
	}
	return true
}

func (service *Service) ownedRecord(w http.ResponseWriter, r *http.Request, limiter *subjectLimiter) (record, bool) {
	subject, ok := service.authorize(w, r)
	if !ok || !service.allow(w, r, limiter, subject) {
		return record{}, false
	}
	owned, err := service.loadRecord(r.Context(), r.PathValue(uploadIDValue))
	if errors.Is(err, errUploadNotFound) || (err == nil && owned.Subject != subject) {
		service.fail(w, r, http.StatusNotFound, errUploadNotFound)
		return record{}, false
	}
	if err != nil {
		service.failInternal(w, r, err)
		return record{}, false
	}
	return owned, true
}
