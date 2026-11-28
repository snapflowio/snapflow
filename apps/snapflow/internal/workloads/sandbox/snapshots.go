// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

type SnapshotSource interface {
	Ensure(ctx context.Context, ref string) (release func(), err error)
}

type Snapshots interface {
	SnapshotSource
	Apply(revision uint64, snapshots []*machinev1alpha1.DesiredSnapshot)
}

func snapshotRef(spec *machinev1alpha1.SandboxSpec) string {
	switch source := spec.GetSource().(type) {
	case *machinev1alpha1.SandboxSpec_Image:
		return source.Image.GetRef()
	case *machinev1alpha1.SandboxSpec_Backup:
		return source.Backup.GetRef()
	default:
		return ""
	}
}
