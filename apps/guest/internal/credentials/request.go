// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package credentials

import (
	"fmt"
	"net/http"
)

const (
	unavailableMessage = "guest service credential is unavailable"
	mismatchMessage    = "invalid guest service credential"
)

type RequestError struct {
	Status  int
	Message string
	Err     error
}

func (e *RequestError) Error() string {
	if e.Err == nil {
		return e.Message
	}
	return fmt.Sprintf("%s: %v", e.Message, e.Err)
}

func (e *RequestError) Unwrap() error {
	return e.Err
}

func VerifyRequest(request *http.Request, header, credentialFile string) *RequestError {
	matches, err := MatchesFile(credentialFile, []byte(request.Header.Get(header)))
	if err != nil {
		return &RequestError{Status: http.StatusServiceUnavailable, Message: unavailableMessage, Err: err}
	}
	if !matches {
		return &RequestError{Status: http.StatusUnauthorized, Message: mismatchMessage}
	}
	return nil
}

func RequireHeader(header, credentialFile string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if rejection := VerifyRequest(request, header, credentialFile); rejection != nil {
			http.Error(writer, rejection.Message, rejection.Status)
			return
		}
		next.ServeHTTP(writer, request)
	})
}
