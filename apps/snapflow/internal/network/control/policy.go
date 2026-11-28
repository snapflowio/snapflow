// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	policyRefreshInterval = 15 * time.Minute
	policyFetchOperation  = "fetch control policy"
	secureScheme          = "https"
)

var ErrRestartRequired = errors.New("machine control policy changed; restart is required")

type ControlPolicy struct {
	SchemaVersion        int
	Revision             int
	IssuedAt             time.Time
	ExpiresAt            time.Time
	GuestRegistryURL     string
	DesktopEnabled       bool
	SerialConsoleEnabled bool
	ConnectionToken      string
}

func (policy ControlPolicy) Validate(observedAt time.Time) error {
	if policy.SchemaVersion <= 0 || policy.Revision <= 0 {
		return errors.New("control policy schema version and revision must be positive")
	}
	if policy.IssuedAt.IsZero() || policy.ExpiresAt.IsZero() || !policy.ExpiresAt.After(policy.IssuedAt) {
		return errors.New("control policy validity window is invalid")
	}
	if !observedAt.Before(policy.ExpiresAt) {
		return errors.New("control policy is expired")
	}
	registry, err := url.Parse(strings.TrimSpace(policy.GuestRegistryURL))
	if err != nil || registry.Scheme == "" || registry.Host == "" {
		return errors.New("control policy guest registry URL is invalid")
	}
	if strings.TrimSpace(policy.ConnectionToken) == "" {
		return errors.New("control policy connection token is required")
	}
	return nil
}

type policyAPI interface {
	Get(context.Context) (*apiclient.MachineControlPolicyDto, error)
}

type generatedPolicyAPI struct {
	client *Client
}

type PolicyMaintainer struct {
	log        *slog.Logger
	api        *generatedPolicyAPI
	production bool
	initial    ControlPolicy
}

func NewPolicyMaintainer(client *Client, production bool, initial ControlPolicy, opts ...Option) (*PolicyMaintainer, error) {
	if client == nil {
		return nil, errors.New("policy control-plane client is required")
	}
	return &PolicyMaintainer{
		log:        newOptions(opts).logger,
		api:        &generatedPolicyAPI{client: client},
		production: production,
		initial:    initial,
	}, nil
}

func (maintainer *PolicyMaintainer) Run(ctx context.Context) error {
	logger, control, production, active := maintainer.log, maintainer.api, maintainer.production, maintainer.initial
	ticker := time.NewTicker(policyRefreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case observedAt := <-ticker.C:
			refreshed, fetchErr := fetchPolicy(ctx, production, control, observedAt)
			if fetchErr != nil {
				if observedAt.Before(active.ExpiresAt) {
					logger.WarnContext(ctx, "Control policy refresh failed; retaining the in-memory policy until expiry", "error", fetchErr, "expires_at", active.ExpiresAt)
					continue
				}
				return fmt.Errorf("control policy expired after refresh failure: %w", fetchErr)
			}
			if err := validateRefresh(active, refreshed); err != nil {
				return err
			}
			active = refreshed
			logger.DebugContext(ctx, "Refreshed machine control policy", "revision", active.Revision, "expires_at", active.ExpiresAt)
		}
	}
}

func validateRefresh(active, refreshed ControlPolicy) error {
	if !runtimePolicyChanged(active, refreshed) {
		return nil
	}
	if refreshed.Revision == active.Revision {
		return fmt.Errorf("control policy revision %d conflicts with active content", refreshed.Revision)
	}
	return fmt.Errorf("%w: revision %d replaces revision %d", ErrRestartRequired, refreshed.Revision, active.Revision)
}

func runtimePolicyChanged(active, refreshed ControlPolicy) bool {
	return active.SchemaVersion != refreshed.SchemaVersion ||
		active.GuestRegistryURL != refreshed.GuestRegistryURL ||
		active.DesktopEnabled != refreshed.DesktopEnabled ||
		active.SerialConsoleEnabled != refreshed.SerialConsoleEnabled ||
		active.ConnectionToken != refreshed.ConnectionToken
}

func ResolvePolicy(
	ctx context.Context,
	client *Client,
	production bool,
) (ControlPolicy, error) {
	if client == nil {
		return ControlPolicy{}, errors.New("policy control-plane client is required")
	}
	return fetchPolicy(ctx, production, &generatedPolicyAPI{client: client}, time.Now())
}

func fetchPolicy(
	ctx context.Context,
	production bool,
	control policyAPI,
	observedAt time.Time,
) (ControlPolicy, error) {
	if control == nil {
		return ControlPolicy{}, errors.New("policy control plane is required")
	}
	response, err := control.Get(ctx)
	if err != nil {
		return ControlPolicy{}, err
	}
	if response == nil {
		return ControlPolicy{}, errors.New("control policy response is empty")
	}
	resolved := ControlPolicy{
		SchemaVersion:        response.SchemaVersion,
		Revision:             response.Revision,
		IssuedAt:             response.IssuedAt,
		ExpiresAt:            response.ExpiresAt,
		GuestRegistryURL:     response.GuestRegistryUrl,
		DesktopEnabled:       response.DesktopEnabled,
		SerialConsoleEnabled: response.SerialConsoleEnabled,
		ConnectionToken:      response.ConnectionToken,
	}
	if err := resolved.Validate(observedAt); err != nil {
		return ControlPolicy{}, fmt.Errorf("validate control policy: %w", err)
	}
	if production {
		registry, parseErr := url.Parse(resolved.GuestRegistryURL)
		if parseErr != nil || registry.Scheme != secureScheme {
			return ControlPolicy{}, errors.New("production control policy guest registry must use HTTPS")
		}
	}
	return resolved, nil
}

func (control *generatedPolicyAPI) Get(ctx context.Context) (*apiclient.MachineControlPolicyDto, error) {
	result, err := control.client.GetMachineControlPolicyWithResponse(ctx)
	return apierror.Decode(policyFetchOperation, result, err, (*apiclient.GetMachineControlPolicyResult).GetJSON200)
}
