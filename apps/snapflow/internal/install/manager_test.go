// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"testing"

	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/tuf"
)

const (
	testVersion        = "1.2.0"
	testTrustedVersion = "1.10.0"
	testDigest         = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
	testOtherDigest    = "sha256:2222222222222222222222222222222222222222222222222222222222222222"
)

func TestAdmitRelease(t *testing.T) {
	selected := InstallationRequest{Version: testVersion, Channel: tuf.StableChannel}
	active := &ReleaseRecord{Digest: testDigest, Channel: tuf.StableChannel, Version: testVersion}
	tests := map[string]struct {
		journal  Journal
		manifest release.Manifest
		digest   string
		admitted bool
	}{
		"a first release is admitted": {
			manifest: release.Manifest{Version: testVersion}, digest: testDigest, admitted: true,
		},
		"a newer release is admitted": {
			journal:  Journal{HighestVersion: "1.1.9"},
			manifest: release.Manifest{Version: testVersion}, digest: testDigest, admitted: true,
		},
		"the installed release is admitted again": {
			journal:  Journal{HighestVersion: testVersion, Active: active},
			manifest: release.Manifest{Version: testVersion}, digest: testDigest, admitted: true,
		},
		"a release older than the trusted version is refused": {
			journal:  Journal{HighestVersion: testTrustedVersion},
			manifest: release.Manifest{Version: testVersion}, digest: testDigest,
		},
		"a different bundle with the trusted version is refused": {
			journal:  Journal{HighestVersion: testVersion, Active: active},
			manifest: release.Manifest{Version: testVersion}, digest: testOtherDigest,
		},
		"a release that does not match the channel version is refused": {
			manifest: release.Manifest{Version: "1.2.1"}, digest: testDigest,
		},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			err := admitRelease(test.journal, release.VerifiedRelease{Manifest: test.manifest}, selected, test.digest)
			if (err == nil) != test.admitted {
				t.Fatalf("admitRelease() error = %v, admitted = %t", err, test.admitted)
			}
		})
	}
}
