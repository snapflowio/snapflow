// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"errors"
	"fmt"
	"strings"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const OCIDigestPrefix = "sha256:"

var ErrLocalSnapshotNotHeld = errors.New("the locally built snapshot is not held yet")

func validateDesiredSnapshots(snapshots []*machinev1alpha1.DesiredSnapshot) error {
	listed := make(map[string]bool, len(snapshots))
	errs := make([]error, 0, len(snapshots))
	for index, snapshot := range snapshots {
		field := fmt.Sprintf("snapshots[%d]", index)
		if listed[snapshot.GetRef()] {
			errs = append(errs, fmt.Errorf("%s lists snapshot %s twice", field, snapshot.GetRef()))
		}
		listed[snapshot.GetRef()] = true
		errs = append(errs, validateDesiredSnapshot(field, snapshot))
	}
	return errors.Join(errs...)
}

func validateDesiredSnapshot(field string, snapshot *machinev1alpha1.DesiredSnapshot) error {
	errs := []error{
		requiredField(field+".ref", snapshot.GetRef()),
		optionalDigestField(field+".digest", snapshot.Digest),
		validateOptionalTemplate(field+".template", snapshot.GetTemplate()),
	}
	switch source := snapshot.GetSource().(type) {
	case *machinev1alpha1.DesiredSnapshot_Registry:
		errs = append(errs, optionalUUIDField(field+".registry.registryId", source.Registry.RegistryId))
	case *machinev1alpha1.DesiredSnapshot_Local:
	default:
		errs = append(errs, fmt.Errorf("%s requires a registry or local source", field))
	}
	return errors.Join(errs...)
}

func optionalDigestField(field string, value *string) error {
	if value == nil {
		return nil
	}
	hexadecimal, found := strings.CutPrefix(*value, OCIDigestPrefix)
	if !found {
		return fmt.Errorf("%s must start with %s", field, OCIDigestPrefix)
	}
	return sha256HexField(field, hexadecimal)
}
