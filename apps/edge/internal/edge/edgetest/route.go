// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edgetest

import "github.com/google/uuid"

const (
	defaultAssignmentGeneration = 1
	defaultExposureGeneration   = 1
	defaultSandboxID            = "sandbox-edgetest"
	defaultExposureName         = "web"
	defaultTargetHost           = "runtime"
	defaultTargetPort           = 8080
	defaultTrafficWeight        = 100
	defaultPath                 = "/"
	defaultMaxBodyBytes         = 1 << 20
	defaultTimeoutSeconds       = 30
)

type Route struct {
	Host      string
	Backend   string
	BackendID uuid.UUID
}

func HTTPRoute(host, backend string) Route {
	return Route{Host: host, Backend: backend, BackendID: uuid.New()}
}
