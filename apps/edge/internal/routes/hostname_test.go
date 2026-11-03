// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"testing"
)

func TestHostnameValidationAllowsCanonicalHostAndNumericPort(t *testing.T) {
	t.Parallel()
	for _, hostname := range []string{
		"preview.snapflow.test",
		"PREVIEW.SNAPFLOW.TEST.",
		"preview.snapflow.test:443",
		"xn--bcher-kva.example",
	} {
		if !IsValidHostname(hostname) {
			t.Fatalf("valid hostname %q was rejected", hostname)
		}
	}
}
