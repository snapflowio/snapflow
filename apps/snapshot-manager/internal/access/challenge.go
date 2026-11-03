// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"fmt"
	"net/http"
)

const challengeHeader = "WWW-Authenticate"

type challenge struct {
	realm string
	err   error
}

func (c challenge) SetHeaders(request *http.Request, w http.ResponseWriter) {
	w.Header().Set(challengeHeader, fmt.Sprintf("Basic realm=%q", c.realm))
}

func (c challenge) Error() string {
	return fmt.Sprintf("basic authentication challenge for realm %q: %s", c.realm, c.err)
}

func (c challenge) Unwrap() error {
	return c.err
}
