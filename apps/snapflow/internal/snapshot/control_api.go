// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"errors"
	"fmt"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	fetchCredentialsOperation = "fetch snapshot registry credentials"
	reportInventoryOperation  = "report snapshot inventory"
)

type generatedControlPlane struct {
	client *control.Client
}

func NewControlPlane(client *control.Client) (ControlPlane, error) {
	if client == nil {
		return nil, errors.New("snapshot control-plane client is required")
	}
	return &generatedControlPlane{client: client}, nil
}

func (api *generatedControlPlane) RegistryCredentials(ctx context.Context, registryID string) (*machinev1alpha1.Registry, error) {
	response, err := api.client.GetMachineSnapshotRegistryCredentialsWithResponse(ctx, registryID)
	delivered, err := apierror.Decode(
		fetchCredentialsOperation, response, err,
		(*apiclient.GetMachineSnapshotRegistryCredentialsResult).GetJSON200,
	)
	if err != nil {
		return nil, err
	}
	credentials := &machinev1alpha1.SnapshotRegistryCredentials{}
	if err := workload.Decode(delivered.Credentials, credentials); err != nil {
		return nil, err
	}
	if credentials.GetRegistryId() != registryID {
		return nil, fmt.Errorf("%s: API delivered the credentials of another registry", fetchCredentialsOperation)
	}
	return credentials.GetRegistry(), nil
}

func (api *generatedControlPlane) ReportInventory(ctx context.Context, inventory *machinev1alpha1.MachineSnapshotInventory) error {
	encoded, err := protojson.Marshal(inventory)
	if err != nil {
		return fmt.Errorf("encode snapshot inventory: %w", err)
	}
	response, err := api.client.ReportMachineSnapshotInventoryWithResponse(
		ctx,
		apiclient.MachineSnapshotInventoryReportDto{Inventory: string(encoded)},
	)
	return apierror.CheckResponse(reportInventoryOperation, response, err)
}
