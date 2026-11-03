// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	tunnelsPerSlot                = 2
	tunnelControlTimeout          = 10 * time.Second
	tunnelPlanWait                = control.LongPollWait
	tunnelPlanReadTimeout         = tunnelPlanWait + tunnelControlTimeout
	minimumTunnelPlanReadInterval = 250 * time.Millisecond
	tunnelPlanExpiryCheck         = time.Second
	maximumMachineTunnelStreams   = 100_000
)

type RuntimeTargetDialer interface {
	DialRuntimePort(context.Context, string, microvmtypes.RuntimePortTarget) (net.Conn, error)
	GuestServiceTarget(context.Context, string, string) (*microvmtypes.ProxyTarget, error)
}

type BuildLogDialer interface {
	DialBuildLog(context.Context, string) (net.Conn, error)
}

type SSHGatewayDialer interface {
	DialSSHGateway(context.Context) (net.Conn, error)
}

type ManagerConfig struct {
	Session   control.SessionCredentials
	MachineID uuid.UUID
}

type ManagerDependencies struct {
	Runtime    RuntimeTargetDialer
	BuildLogs  BuildLogDialer
	SSHGateway SSHGatewayDialer
	Control    *ControlPlane
}

type tunnelSlot struct {
	active      *edgeTunnel
	replacement *edgeTunnel
}

type Manager struct {
	log                    *slog.Logger
	runtime                RuntimeTargetDialer
	buildLogs              BuildLogDialer
	sshGateway             SSHGatewayDialer
	control                tunnelControl
	credentials            control.SessionCredentials
	machineID              uuid.UUID
	issuer                 *certificateIssuer
	streams                *streamAdmission
	current                atomic.Pointer[plan.Plan]
	planMu                 sync.Mutex
	acknowledgementPending bool
	observedDigest         string
	mu                     sync.Mutex
	tunnels                map[uuid.UUID]*tunnelSlot
	prepared               bool
	stateChanged           chan struct{}
}

func NewManager(cfg ManagerConfig, deps ManagerDependencies, opts ...Option) (*Manager, error) {
	if deps.Runtime == nil || deps.BuildLogs == nil || deps.Control == nil || cfg.MachineID == uuid.Nil {
		return nil, errors.New("machine tunnel manager dependencies are incomplete")
	}
	if err := cfg.Session.Validate(); err != nil {
		return nil, err
	}
	issuer, err := newCertificateIssuer(
		deps.Control,
		cfg.Session.Generation,
		cfg.MachineID,
	)
	if err != nil {
		return nil, err
	}
	streams, err := newStreamAdmission(maximumMachineTunnelStreams)
	if err != nil {
		return nil, err
	}
	return &Manager{
		log:         newOptions(opts).logger.With(slog.String("component", "machine_tunnels")),
		runtime:     deps.Runtime,
		buildLogs:   deps.BuildLogs,
		sshGateway:  deps.SSHGateway,
		control:     deps.Control,
		credentials: cfg.Session, machineID: cfg.MachineID,
		issuer: issuer, streams: streams,
		tunnels:      make(map[uuid.UUID]*tunnelSlot),
		stateChanged: make(chan struct{}, 1),
	}, nil
}

func (manager *Manager) Prepare(
	preparationContext context.Context,
	lifecycleContext context.Context,
) error {
	manager.mu.Lock()
	if manager.prepared {
		manager.mu.Unlock()
		return errors.New("machine tunnel manager is already prepared")
	}
	manager.mu.Unlock()

	if err := manager.refreshUntilAccepted(preparationContext, lifecycleContext); err != nil {
		manager.closeTunnels()
		return fmt.Errorf("prepare machine tunnel plan: %w", err)
	}
	tunnelPlan := manager.current.Load()
	if tunnelPlan == nil || !tunnelPlan.ValidAt(time.Now()) {
		manager.closeTunnels()
		return errors.New("control plane returned no valid machine tunnel plan")
	}
	if err := manager.waitUntilReady(preparationContext, *tunnelPlan); err != nil {
		manager.closeTunnels()
		return err
	}
	manager.mu.Lock()
	manager.prepared = true
	manager.mu.Unlock()
	return nil
}

func (manager *Manager) Run(ctx context.Context) error {
	manager.mu.Lock()
	prepared := manager.prepared
	manager.mu.Unlock()
	if !prepared {
		return errors.New("machine tunnel manager is not prepared")
	}
	expiryTicker := time.NewTicker(tunnelPlanExpiryCheck)
	defer expiryTicker.Stop()
	defer manager.closeTunnels()
	watchContext, stopWatching := context.WithCancel(ctx)
	watchFailure := make(chan error, 1)
	watchDone := make(chan struct{})
	go func() {
		defer close(watchDone)
		if err := manager.watchPlans(watchContext); err != nil {
			watchFailure <- err
		}
	}()
	defer func() {
		stopWatching()
		<-watchDone
	}()
	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-watchFailure:
			return err
		case now := <-expiryTicker.C:
			manager.expirePlan(now)
		}
	}
}

func (manager *Manager) Close() {
	manager.closeTunnels()
}

func (manager *Manager) reconcile(ctx context.Context, tunnelPlan plan.Plan) {
	manager.mu.Lock()
	closing := make([]*edgeTunnel, 0)
	for edgeID, slot := range manager.tunnels {
		desired, exists := bindingForEdge(tunnelPlan, edgeID)
		if !exists {
			delete(manager.tunnels, edgeID)
			closing = appendTunnel(closing, slot.active, slot.replacement)
			continue
		}
		closing = appendTunnel(closing, manager.reconcileSlot(ctx, slot, desired))
	}
	for _, binding := range tunnelPlan.Bindings {
		if _, exists := manager.tunnels[binding.EdgeID]; exists {
			continue
		}
		replacement := manager.startTunnel(ctx, binding)
		manager.tunnels[binding.EdgeID] = &tunnelSlot{replacement: replacement}
	}
	manager.mu.Unlock()
	manager.signalStateChanged()
	for _, tunnel := range closing {
		tunnel.close()
	}
}

func (manager *Manager) reconcileSlot(ctx context.Context, slot *tunnelSlot, desired plan.Binding) (stale *edgeTunnel) {
	if slot.replacement != nil && slot.replacement.binding.SameConnection(desired) {
		return nil
	}
	stale, slot.replacement = slot.replacement, nil
	if slot.active == nil || !slot.active.binding.SameConnection(desired) {
		slot.replacement = manager.startTunnel(ctx, desired)
	}
	return stale
}

func (manager *Manager) startTunnel(ctx context.Context, binding plan.Binding) *edgeTunnel {
	tunnel := newEdgeTunnel(ctx, manager, binding)
	go manager.promoteWhenReady(ctx, tunnel)
	return tunnel
}

func (manager *Manager) promoteWhenReady(ctx context.Context, replacement *edgeTunnel) {
	if !replacement.waitReady(ctx) {
		return
	}
	manager.mu.Lock()
	slot := manager.tunnels[replacement.binding.EdgeID]
	if slot == nil || slot.replacement != replacement {
		manager.mu.Unlock()
		replacement.close()
		return
	}
	previous := slot.active
	slot.active = replacement
	slot.replacement = nil
	manager.mu.Unlock()
	manager.signalStateChanged()
	if previous != nil {
		previous.close()
	}
	manager.log.Info(
		"Machine tunnel ready",
		"edge_id", replacement.binding.EdgeID,
		"binding_id", replacement.binding.Identity.ID,
	)
}

func (manager *Manager) waitUntilReady(ctx context.Context, tunnelPlan plan.Plan) error {
	for {
		manager.mu.Lock()
		ready := true
		for _, binding := range tunnelPlan.Bindings {
			slot := manager.tunnels[binding.EdgeID]
			if slot == nil || slot.active == nil || !slot.active.binding.SameConnection(binding) {
				ready = false
				break
			}
		}
		manager.mu.Unlock()
		if ready {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("wait for machine tunnel readiness: %w", ctx.Err())
		case <-manager.stateChanged:
		}
	}
}

func (manager *Manager) signalStateChanged() {
	select {
	case manager.stateChanged <- struct{}{}:
	default:
	}
}

func (manager *Manager) closeTunnels() {
	manager.mu.Lock()
	closing := make([]*edgeTunnel, 0, len(manager.tunnels)*tunnelsPerSlot)
	for edgeID, slot := range manager.tunnels {
		delete(manager.tunnels, edgeID)
		closing = appendTunnel(closing, slot.active, slot.replacement)
	}
	manager.mu.Unlock()
	for _, tunnel := range closing {
		tunnel.close()
	}
}

func (manager *Manager) target(
	binding protocol.Binding,
	backendID uuid.UUID,
	generation uint32,
) (plan.Target, bool) {
	tunnelPlan := manager.current.Load()
	if tunnelPlan == nil || !tunnelPlan.ValidAt(time.Now()) {
		return plan.Target{}, false
	}
	return tunnelPlan.TargetFor(binding, backendID, generation, time.Now())
}

func bindingForEdge(tunnelPlan plan.Plan, edgeID uuid.UUID) (plan.Binding, bool) {
	for _, binding := range tunnelPlan.Bindings {
		if binding.EdgeID == edgeID {
			return binding, true
		}
	}
	return plan.Binding{}, false
}

func appendTunnel(destination []*edgeTunnel, tunnels ...*edgeTunnel) []*edgeTunnel {
	for _, tunnel := range tunnels {
		if tunnel != nil {
			destination = append(destination, tunnel)
		}
	}
	return destination
}
