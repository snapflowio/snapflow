// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	fetchDesiredStateOperation = "fetch machine desired state"
	fetchSecretsOperation      = "fetch sandbox secrets"
	reportStatusOperation      = "report sandbox observed status"
	entityTagQuote             = `"`
	desiredStateWait           = control.LongPollWait
)

type ConvergenceAPI interface {
	SecretSource
	FetchDesiredState(ctx context.Context, digest string) (document *apiclient.MachineDesiredStateDocumentDto, changed bool, err error)
	ReportStatus(context.Context, *machinev1alpha1.SandboxObservedStatusReport) (*machinev1alpha1.SandboxObservedStatusReportResult, error)
}

type SecretSource interface {
	Secrets(context.Context, sandboxruntime.Assignment, uint32) (*machinev1alpha1.SandboxSecrets, error)
}

type ControlPlane struct {
	client *control.Client
}

func NewControlPlane(client *control.Client) (*ControlPlane, error) {
	if client == nil {
		return nil, errors.New("desired-state control-plane client is required")
	}
	return &ControlPlane{client: client}, nil
}

func (api *ControlPlane) FetchDesiredState(
	ctx context.Context,
	digest string,
) (*apiclient.MachineDesiredStateDocumentDto, bool, error) {
	waitSeconds := int(desiredStateWait / time.Second)
	params := &apiclient.GetMachineDesiredStateParams{WaitSeconds: &waitSeconds}
	if digest != "" {
		entityTag := entityTagQuote + digest + entityTagQuote
		params.IfNoneMatch = &entityTag
	}
	response, err := api.client.GetMachineDesiredStateWithResponse(ctx, params)
	if err == nil && response.StatusCode() == http.StatusNotModified {
		return nil, false, nil
	}
	document, err := apierror.Decode(
		fetchDesiredStateOperation, response, err, (*apiclient.GetMachineDesiredStateResult).GetJSON200,
	)
	if err != nil {
		return nil, false, err
	}
	return document, true, nil
}

func (api *ControlPlane) Secrets(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	specGeneration uint32,
) (*machinev1alpha1.SandboxSecrets, error) {
	assignmentGeneration, err := apiGeneration(assignment.Generation)
	if err != nil {
		return nil, err
	}
	requestedSpecGeneration, err := apiGeneration(specGeneration)
	if err != nil {
		return nil, err
	}
	response, err := api.client.GetMachineSandboxSecretsWithResponse(
		ctx,
		assignment.SandboxID,
		&apiclient.GetMachineSandboxSecretsParams{
			AssignmentGeneration: assignmentGeneration,
			SpecGeneration:       requestedSpecGeneration,
		},
	)
	delivered, err := apierror.Decode(
		fetchSecretsOperation, response, err, (*apiclient.GetMachineSandboxSecretsResult).GetJSON200,
	)
	if err != nil {
		return nil, err
	}
	secrets := &machinev1alpha1.SandboxSecrets{}
	if err := workload.Decode(delivered.Secrets, secrets); err != nil {
		return nil, err
	}
	if secrets.GetSandboxId() != assignment.SandboxID ||
		secrets.GetAssignmentGeneration() != assignment.Generation ||
		secrets.GetSpecGeneration() != specGeneration {
		workload.ClearSecrets(secrets.GetEnv())
		return nil, fmt.Errorf("fetch sandbox secrets: API delivered the secrets of another sandbox generation")
	}
	return secrets, nil
}

func (api *ControlPlane) ReportStatus(
	ctx context.Context,
	report *machinev1alpha1.SandboxObservedStatusReport,
) (*machinev1alpha1.SandboxObservedStatusReportResult, error) {
	encoded, err := protojson.Marshal(report)
	if err != nil {
		return nil, fmt.Errorf("encode sandbox observed status report: %w", err)
	}
	response, err := api.client.ReportMachineObservedStatusWithResponse(
		ctx,
		apiclient.MachineObservedStatusReportDto{Report: string(encoded)},
	)
	acknowledged, err := apierror.Decode(
		reportStatusOperation, response, err, (*apiclient.ReportMachineObservedStatusResult).GetJSON200,
	)
	if err != nil {
		return nil, err
	}
	result := &machinev1alpha1.SandboxObservedStatusReportResult{}
	if err := workload.Decode(acknowledged.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func apiGeneration(generation uint32) (int, error) {
	if generation > math.MaxInt32 {
		return 0, fmt.Errorf("generation %d exceeds the API range", generation)
	}
	return int(generation), nil
}
