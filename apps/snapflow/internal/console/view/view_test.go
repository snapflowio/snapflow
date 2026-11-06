// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"strings"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/cli/clitest"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	"github.com/snapflowio/snapflow/internal/console/update"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/install"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testMachineID = "f2a749e8-7f31-4ad3-8e12-8de345be5e3b"
	testDashboard = "https://snapflow.io/dashboard/machines"
)

func float(value float32) *float32 {
	return &value
}

const testCity = "Frankfurt am Main"

func readyStatus() admin.StatusResult {
	city := testCity
	installedAt := time.Date(2026, time.October, 1, 4, 30, 0, 0, time.UTC)
	benchmarkState := apiclient.BenchmarkStatePassed
	machine := apiclient.MachineIdentityStatus{
		Id: testMachineID, Name: "rack-04", State: apiclient.MachineStateReady,
		Cpu: 16, Memory: 64, Disk: 1000,
		CurrentCpuUsagePercentage: float(32), CurrentMemoryUsagePercentage: float(81), CurrentDiskUsagePercentage: float(93),
		CurrentAllocatedCpu: float(6), CurrentAllocatedMemoryGiB: float(24), CurrentAllocatedDiskGiB: float(120),
		CurrentStartedSandboxes: float(3), Payouts: apiclient.PayoutReadinessReady,
		Location: &apiclient.Location{Country: "DE", Continent: apiclient.ContinentEurope, City: &city},
		ServiceHealth: &[]apiclient.MachineServiceHealth{
			{ServiceName: "edge-tunnel", Healthy: true},
			{ServiceName: "runtime", Healthy: true},
		},
		Marketplace: &apiclient.MachineMarketplaceStatus{
			Tier: apiclient.MachineTierCommunity, ListingState: apiclient.ListingStateListed,
			Visibility: apiclient.ListingVisibilityPublic, Reasons: []string{}, LatestBenchmarkState: &benchmarkState,
		},
	}
	return admin.StatusResult{
		Profile: "production", Ready: true,
		Registration: admin.RegistrationStatus{Registered: true, MachineID: testMachineID},
		ControlPlane: &machine,
		Daemon:       admin.DaemonStatus{Reachable: true, Version: "1.4.2"},
		Release: admin.ReleaseStatus{
			Active:   &install.ReleaseRecord{Version: "1.4.2", InstalledAt: installedAt},
			Verified: true,
		},
		Update:       update.Status{Phase: update.PhaseIdle, Channel: "stable", MaintenanceWindow: update.MaintenanceWindowUTC},
		Service:      &admin.ServiceStatus{Active: true, Enabled: true},
		RecentErrors: []string{}, DashboardURL: testDashboard, Errors: []string{},
	}
}

func TestStatusReady(t *testing.T) {
	clitest.Assert(t, "status_ready", Status(style.New(true), readyStatus()))
}

func TestStatusQualifyingWithProblems(t *testing.T) {
	status := readyStatus()
	status.Ready = false
	status.ControlPlane.State = apiclient.MachineStateInitializing
	status.ControlPlane.Unschedulable = true
	status.ControlPlane.Payouts = apiclient.PayoutReadinessNotSetUp
	reason := "qualification challenge pending"
	status.ControlPlane.ReadinessReason = &reason
	failure := "tunnel handshake timed out"
	(*status.ControlPlane.ServiceHealth)[0] = apiclient.MachineServiceHealth{ServiceName: "edge-tunnel", ErrorReason: &failure}
	status.Daemon = admin.DaemonStatus{Error: "connection refused"}
	status.Service = &admin.ServiceStatus{Active: false, Enabled: true}
	status.RecentErrors = []string{"level=ERROR msg=\"edge tunnel closed\""}
	status.PaymentHolds = []admin.PaymentHold{{SandboxID: testSandboxID, HeldAt: testHeldAt()}}
	status.Errors = []string{"the Snapflow service is not active and enabled"}
	pending := apiclient.BenchmarkStatePending
	status.ControlPlane.Marketplace = &apiclient.MachineMarketplaceStatus{
		Tier: apiclient.MachineTierPrivate, ListingState: apiclient.ListingStateDraft,
		Visibility: apiclient.ListingVisibilityPrivate, Reasons: []string{"listing_not_public", "kyc_incomplete"},
		LatestBenchmarkState: &pending,
	}
	clitest.Assert(t, "status_degraded", Status(style.New(true), status))
}

func TestStatusBeforeTheMachineExists(t *testing.T) {
	status := readyStatus()
	status.ControlPlane.Marketplace = nil
	clitest.Assert(t, "status_unlisted", Status(style.New(true), status))
}

func TestStatusNotRegistered(t *testing.T) {
	status := admin.StatusResult{Profile: string(config.Production), DashboardURL: testDashboard}
	clitest.Assert(t, "status_not_registered", Status(style.New(false), status))
}

const (
	testSandboxID = "0b9d4f62-5d1c-4f0e-9a51-3c7e2f8b6a14"
	testLeaseID   = "5e0c7a1b-8d42-4c9f-b6e3-2f1a9d7c4b08"
	testChannelID = "0x706f247b800ddcfc035df6460f09a2d3a7b2f718ef245fe540e82e2277a23255"
	testPayoutURL = "https://snapflow.io/dashboard/earnings/payouts"
)

func testHeldAt() time.Time {
	return time.Date(2026, time.November, 5, 9, 15, 0, 0, time.UTC)
}

func TestPayout(t *testing.T) {
	for name, readiness := range map[string]apiclient.PayoutReadiness{
		"payout_ready":   apiclient.PayoutReadinessReady,
		"payout_blocked": apiclient.PayoutReadinessBlocked,
	} {
		result := admin.PayoutResult{Profile: "production", Readiness: readiness, PayoutURL: testPayoutURL}
		clitest.Assert(t, name, Payout(style.New(true), result))
	}
}

func TestVouchers(t *testing.T) {
	heldAt := testHeldAt()
	acceptedAt := heldAt.Add(-time.Hour)
	result := admin.VouchersResult{Profile: "production", Vouchers: []admin.PaymentVoucher{
		{
			ChannelID: testChannelID, SandboxID: testSandboxID, LeaseID: testLeaseID,
			State: apiclient.PaymentChannelStateOpen, AcceptedAt: &acceptedAt, HeldAt: &heldAt,
			Domain: &apiclient.EscrowDomain{ChainId: 84532, Name: "SnapflowEscrow", Version: "1"},
			Voucher: &apiclient.MachineSignedVoucher{
				ChannelId: testChannelID, Sequence: "2", HostAmount: "123456789", FeeAmount: "24691357",
				ServiceAmount: "0", Expiry: "1900000000",
			},
		},
		{
			ChannelID: testChannelID, SandboxID: testMachineID, LeaseID: testLeaseID,
			State: apiclient.PaymentChannelStateOpen,
		},
	}}
	clitest.Assert(t, "vouchers", Vouchers(style.New(true), result))
	clitest.Assert(t, "vouchers_none", Vouchers(style.New(true), admin.VouchersResult{Profile: "production"}))
}

func TestUSDCKeepsEveryBaseUnit(t *testing.T) {
	for baseUnits, want := range map[string]string{"0": "0.000000", "1": "0.000001", "123456789": "123.456789", "bogus": "bogus"} {
		if got := usdc(baseUnits); got != want {
			t.Errorf("usdc(%q) = %q, want %q", baseUnits, got, want)
		}
	}
}

func TestChecks(t *testing.T) {
	checks := []doctor.DiagnosticCheck{
		{Name: doctor.CheckKVM, Status: doctor.CheckPassed, Required: true, Detail: "/dev/kvm is readable and writable"},
		{
			Name: doctor.CheckHostTools, Status: doctor.CheckFailed, Required: true, Detail: "mkfs.ext4 not found",
			Remediation: "install the filesystem tools",
		},
		{
			Name: doctor.CheckReflink, Status: doctor.CheckPending, Detail: "checked once the runtime data directory exists",
			Remediation: "use XFS or Btrfs",
		},
	}
	theme := style.New(true)
	lines := []string{}
	for _, check := range checks {
		lines = append(lines, Check(theme, check))
	}
	lines = append(lines, "", DiagnosisSummary(theme, doctor.Diagnosis{Checks: checks}))
	clitest.Assert(t, "checks", Lines(lines...))
}

func TestApprovalWithoutQR(t *testing.T) {
	code := control.DeviceAuthorization{
		DeviceCode: "device-secret", UserCode: "XKHM-R59E", VerificationURI: testDashboard,
		VerificationURIComplete: testDashboard + "?code=XKHM-R59E", ExpiresIn: 600, Interval: 5,
	}
	rendered, err := Approval(style.New(true), ApprovalConfig{Code: code, Status: "Waiting for approval…"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(rendered, code.DeviceCode) {
		t.Fatal("approval panel shows the device code polling secret")
	}
	clitest.Assert(t, "approval", rendered)
}

func TestUpdateCheck(t *testing.T) {
	check := admin.UpdateCheck{
		Channel: "stable", AvailableVersion: "1.5.0",
		InstalledVersion: "1.4.2", UpdateAvailable: true,
	}
	clitest.Assert(t, "update_available", UpdateCheck(style.New(true), "production", check))
}

func TestQRIsSquareAndUsesBothPolarities(t *testing.T) {
	dark, err := QR(testDashboard+"?code=XKHM-R59E", true)
	if err != nil {
		t.Fatal(err)
	}
	light, err := QR(testDashboard+"?code=XKHM-R59E", false)
	if err != nil {
		t.Fatal(err)
	}
	darkRows, lightRows := strings.Split(dark, "\n"), strings.Split(light, "\n")
	width, rows := len([]rune(darkRows[0])), len(darkRows)
	if len(lightRows) != rows || (width != 2*rows && width != 2*rows-1) {
		t.Fatalf("QR is %d rows of %d cells", rows, width)
	}
	if dark == light {
		t.Fatal("dark and light terminals render the same QR polarity")
	}
	if !strings.HasPrefix(darkRows[0], glyphFull) || strings.HasPrefix(lightRows[0], glyphFull) {
		t.Fatal("the quiet zone must be lit only on dark terminals")
	}
}

func TestOrganizations(t *testing.T) {
	personal := control.Organization{ID: "3f6c2a1e-9b7d-4c58-8e21-6a0d4b9f7c13", Name: "Garage", Slug: "garage"}
	team := control.Organization{ID: "7b1d0c5e-2a4f-4e8b-9c36-1f5a8d2e6b40", Name: "Acme Compute", Slug: "acme"}
	choice := control.OrganizationChoice{Organizations: []control.Organization{personal, team}, Active: team}
	clitest.Assert(t, "organizations", Organizations(style.New(true), choice))
}

func TestIdentityShowsTheOwningOrganization(t *testing.T) {
	identity := admin.RegistrationStatus{
		Registered: true, MachineID: testMachineID,
		OwnerID: "7b1d0c5e-2a4f-4e8b-9c36-1f5a8d2e6b40", ControlPlane: "https://api.snapflow.io/api",
	}
	clitest.Assert(t, "identity", Identity(style.New(true), "production", identity))
}
