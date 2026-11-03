// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import "github.com/distribution/distribution/v3/configuration"

const (
	Name       = "snapflow"
	MirrorName = "snapflow-mirror"

	OptionRealm     = "realm"
	OptionVerifier  = "verifier"
	OptionNamespace = "namespace"

	Realm       = "Snapflow Snapshot Manager"
	MirrorRealm = "Snapflow Docker Hub Mirror"

	// MirrorNamespace prefixes mirror repositories in token scopes, so a token
	// must name the mirror explicitly to pull through it.
	MirrorNamespace = "mirror/docker.io"
)

func Parameters(verifier *Verifier) configuration.Parameters {
	return configuration.Parameters{
		OptionRealm:    Realm,
		OptionVerifier: verifier,
	}
}

func MirrorParameters(verifier *Verifier) configuration.Parameters {
	return configuration.Parameters{
		OptionRealm:     MirrorRealm,
		OptionVerifier:  verifier,
		OptionNamespace: MirrorNamespace,
	}
}
