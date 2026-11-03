// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admin

import (
	"context"
	"errors"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/update"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const recentErrorLimit = 5

type RegistrationStatus struct {
	Registered   bool   `json:"registered"`
	MachineID    string `json:"machineId,omitempty"`
	OwnerID      string `json:"ownerId,omitempty"`
	ControlPlane string `json:"controlPlane,omitempty"`
	Error        string `json:"error,omitempty"`
	NeedsReplace bool   `json:"needsReplace,omitempty"`
}

type ReleaseStatus struct {
	Active            *install.ReleaseRecord `json:"active,omitempty"`
	Previous          *install.ReleaseRecord `json:"previous,omitempty"`
	Verified          bool                   `json:"verified"`
	VerifiedVersion   string                 `json:"verifiedVersion,omitempty"`
	VerificationError string                 `json:"verificationError,omitempty"`
}

type StatusResult struct {
	Profile      string                           `json:"profile"`
	Ready        bool                             `json:"ready"`
	Registration RegistrationStatus               `json:"registration"`
	ControlPlane *apiclient.MachineIdentityStatus `json:"controlPlane,omitempty"`
	Daemon       DaemonStatus                     `json:"daemon"`
	Release      ReleaseStatus                    `json:"release"`
	Update       update.Status                    `json:"update"`
	Service      *ServiceStatus                   `json:"service,omitempty"`
	RecentErrors []string                         `json:"recentErrors"`
	DashboardURL string                           `json:"dashboardUrl"`
	Errors       []string                         `json:"errors"`
}

type StatusConfig struct {
	Config  *config.Config
	Service *ServiceManager
}

func Status(ctx context.Context, cfg StatusConfig) StatusResult {
	configuration := cfg.Config
	result := StatusResult{
		Profile: string(configuration.Profile.Name), Ready: true, RecentErrors: []string{},
		DashboardURL: configuration.Profile.DashboardURL, Errors: []string{},
	}
	result.inspectRegistration(ctx, configuration)
	result.inspectControlPlane(ctx, configuration)
	result.inspectDaemon(ctx, configuration)
	result.inspectRelease(configuration)
	result.inspectUpdate(configuration)
	if cfg.Service != nil {
		result.inspectService(ctx, cfg.Service)
	}
	return result
}

func (result *StatusResult) inspectRegistration(ctx context.Context, cfg *config.Config) {
	inspection, err := state.Inspect(ctx, cfg.Machine.StateDirectory)
	if err != nil {
		result.Registration.Error = err.Error()
		result.fail(err)
		return
	}
	result.Registration = registrationStatus(inspection)
}

func (result *StatusResult) inspectRelease(cfg *config.Config) {
	journal, err := install.InspectJournal(cfg.Profile.ReleaseStateRoot)
	if err != nil {
		result.Release.VerificationError = err.Error()
		result.fail(err)
		return
	}
	result.Release.Active = journal.Active
	result.Release.Previous = journal.Previous
	verified, verifyErr := release.LoadActive(cfg.Profile.InstallationRoot, true)
	if verifyErr != nil {
		result.Release.VerificationError = verifyErr.Error()
		result.fail(verifyErr)
		return
	}
	result.Release.Verified, result.Release.VerifiedVersion = true, verified.Manifest.Version
}

func (result *StatusResult) inspectUpdate(cfg *config.Config) {
	updateStatus, err := update.Inspect(cfg.Profile)
	if err != nil {
		result.fail(err)
		return
	}
	result.Update = updateStatus
	if updateStatus.Phase == update.PhaseFailed {
		result.fail(errors.New(updateStatus.LastFailure))
	}
}

func (result *StatusResult) inspectService(ctx context.Context, service *ServiceManager) {
	serviceStatus, err := service.Status(ctx)
	if err != nil {
		result.fail(err)
		return
	}
	result.Service = &serviceStatus
	if !serviceStatus.Active || !serviceStatus.Enabled {
		result.fail(errors.New("the Snapflow service is not active and enabled"))
	}
	recent, err := service.RecentErrors(ctx, recentErrorLimit)
	if err != nil {
		result.fail(err)
		return
	}
	result.RecentErrors = recent
}

func (result *StatusResult) fail(err error) {
	result.Ready = false
	result.Errors = append(result.Errors, err.Error())
}

func registrationStatus(inspection state.Inspection) RegistrationStatus {
	return RegistrationStatus{
		Registered: inspection.Registered,
		MachineID:  inspection.MachineID, OwnerID: inspection.OwnerID,
		ControlPlane: inspection.APIURL,
	}
}
