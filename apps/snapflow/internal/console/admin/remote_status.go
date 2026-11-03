// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/localapi/contract"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	statusRequestTimeout       = 5 * time.Second
	maximumHealthResponseBytes = 64 * 1024
	controlPlaneStatusRequest  = "read machine status from the control plane"
	schemeHTTP                 = "http"
)

type DaemonStatus struct {
	Reachable bool   `json:"reachable"`
	Version   string `json:"version,omitempty"`
	Error     string `json:"error,omitempty"`
}

func (result *StatusResult) inspectControlPlane(ctx context.Context, cfg *config.Config) {
	if !result.Registration.Registered {
		return
	}
	identity, err := state.LoadIdentity(ctx, cfg.Machine.StateDirectory)
	if errors.Is(err, state.ErrIdentityKeyUnavailable) {
		err = fmt.Errorf("%w: %w", ErrIdentityUnreadable, err)
		result.Registration.NeedsReplace = true
	}
	if err != nil {
		result.Registration.Error = err.Error()
		result.fail(err)
		return
	}
	machine, err := fetchIdentityStatus(ctx, identity)
	if identityRevoked(err) {
		err = fmt.Errorf("%w: %w", ErrMachineRevoked, err)
		result.Registration.Error = err.Error()
		result.Registration.NeedsReplace = true
	}
	if err != nil {
		result.fail(err)
		return
	}
	result.ControlPlane = machine
	if machine.State != apiclient.MachineStateReady {
		result.fail(fmt.Errorf("control plane reports the machine as %s", machine.State))
	}
}

func identityRevoked(err error) bool {
	return apierror.HasStatus(err, http.StatusForbidden) || apierror.HasStatus(err, http.StatusNotFound)
}

func fetchIdentityStatus(ctx context.Context, identity *state.Identity) (*apiclient.MachineIdentityStatus, error) {
	client, err := control.NewForIdentity(identity)
	if err != nil {
		return nil, fmt.Errorf("configure machine control-plane client: %w", err)
	}
	machineID, err := uuid.Parse(identity.MachineID)
	if err != nil {
		return nil, fmt.Errorf("parse machine ID: %w", err)
	}
	requestContext, cancel := context.WithTimeout(ctx, statusRequestTimeout)
	defer cancel()
	response, err := client.GetMachineIdentityStatusWithResponse(
		requestContext,
		apiclient.CreateMachineSessionDto{MachineId: machineID},
	)
	return apierror.Decode(controlPlaneStatusRequest, response, err, (*apiclient.GetMachineIdentityStatusResult).GetJSON200)
}

func (result *StatusResult) inspectDaemon(ctx context.Context, cfg *config.Config) {
	health, err := daemonHealth(ctx, cfg.API)
	if err != nil {
		result.Daemon.Error = err.Error()
		result.fail(err)
		return
	}
	result.Daemon = DaemonStatus{Reachable: true, Version: health.Version}
}

func daemonHealth(ctx context.Context, cfg config.APIConfig) (health contract.HealthResponse, resultErr error) {
	endpoint := url.URL{Scheme: schemeHTTP, Host: net.JoinHostPort(contract.Host, strconv.Itoa(cfg.Port)), Path: contract.HealthRoute}
	requestContext, cancel := context.WithTimeout(ctx, statusRequestTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return contract.HealthResponse{}, fmt.Errorf("create Snapflow API health request: %w", err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return contract.HealthResponse{}, fmt.Errorf("the Snapflow daemon API is unreachable at %s: %w", endpoint.Host, err)
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil && resultErr == nil {
			resultErr = fmt.Errorf("close Snapflow API health response: %w", closeErr)
		}
	}()
	if response.StatusCode != http.StatusOK {
		return contract.HealthResponse{}, fmt.Errorf("the Snapflow daemon API returned HTTP %d", response.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, maximumHealthResponseBytes)).Decode(&health); err != nil {
		return contract.HealthResponse{}, fmt.Errorf("decode Snapflow API health: %w", err)
	}
	return health, nil
}
