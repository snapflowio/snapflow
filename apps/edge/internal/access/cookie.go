// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const (
	CookiePrefix        = "__Host-Snapflow-Access-v1-"
	cookieDigestLength  = 16
	cookiePath          = "/"
	minimumCookieMaxAge = 1
	expiredCookieMaxAge = -1
)

func cookieName(backendID uuid.UUID) string {
	digest := sha256.Sum256(backendID[:])
	return CookiePrefix + hex.EncodeToString(digest[:])[:cookieDigestLength]
}

func sessionCookie(backendID uuid.UUID) *http.Cookie {
	return &http.Cookie{
		Name:        cookieName(backendID),
		Path:        cookiePath,
		Secure:      true,
		HttpOnly:    true,
		SameSite:    http.SameSiteNoneMode,
		Partitioned: true,
	}
}

func setCookie(
	writer http.ResponseWriter,
	backendID uuid.UUID,
	token string,
	expiresAt time.Time,
) {
	cookie := sessionCookie(backendID)
	cookie.Value = token
	cookie.Expires = expiresAt
	cookie.MaxAge = max(minimumCookieMaxAge, int(time.Until(expiresAt).Seconds()))
	http.SetCookie(writer, cookie)
}

func ExpireCookie(writer http.ResponseWriter, backendID uuid.UUID) {
	expired := sessionCookie(backendID)
	expired.MaxAge = expiredCookieMaxAge
	http.SetCookie(writer, expired)
}
