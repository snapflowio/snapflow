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
	"time"

	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	"github.com/snapflowio/tunnel-go/reconnect"
)

func (manager *Manager) refreshUntilAccepted(
	preparationContext context.Context,
	lifecycleContext context.Context,
) error {
	failures := reconnect.DefaultBackoff()
	for {
		err := manager.refresh(preparationContext, lifecycleContext)
		if err == nil || permanentControlError(err) {
			return err
		}
		manager.log.WarnContext(preparationContext, "Machine tunnel plan read failed during startup; retrying", "error", err)
		if !reconnect.Wait(preparationContext, failures.Next()) {
			return errors.Join(err, preparationContext.Err())
		}
	}
}

func (manager *Manager) watchPlans(ctx context.Context) error {
	failures := reconnect.DefaultBackoff()
	for {
		startedAt := time.Now()
		err := manager.refresh(ctx, ctx)
		if ctx.Err() != nil {
			return nil
		}
		delay := minimumTunnelPlanReadInterval - time.Since(startedAt)
		var rejected *rejectedPlanError
		switch {
		case err == nil:
			failures.Reset()
		case errors.As(err, &rejected):
			manager.log.WarnContext(ctx, "Rejected machine tunnel plan; retained last-known-good plan", "error", err)
		case permanentControlError(err):
			return err
		default:
			manager.log.WarnContext(ctx, "Machine tunnel plan refresh failed", "error", err)
			delay = failures.Next()
		}
		if !reconnect.Wait(ctx, delay) {
			return nil
		}
	}
}

func (manager *Manager) refresh(
	requestContext context.Context,
	tunnelContext context.Context,
) error {
	current := manager.current.Load()
	if current != nil && manager.acknowledgementPending {
		if err := manager.acknowledge(requestContext, *current); err != nil {
			return err
		}
	}
	controlContext, cancel := context.WithTimeout(requestContext, tunnelPlanReadTimeout)
	document, changed, err := manager.control.FetchPlan(controlContext, manager.observedDigest)
	cancel()
	if err != nil {
		return err
	}
	if !changed {
		return nil
	}
	manager.observedDigest = document.Digest
	tunnelPlan, err := plan.Parse(document, manager.machineID, manager.credentials.Generation, time.Now())
	if err != nil {
		return &rejectedPlanError{cause: err}
	}
	if err := manager.install(tunnelContext, tunnelPlan); err != nil {
		return err
	}
	if err := manager.acknowledge(requestContext, tunnelPlan); err != nil {
		return err
	}
	manager.log.DebugContext(requestContext, "Installed machine tunnel plan", "version", tunnelPlan.Version)
	return nil
}

type rejectedPlanError struct {
	cause error
}

func (failure *rejectedPlanError) Error() string {
	return fmt.Sprintf("validate machine tunnel plan: %v", failure.cause)
}

func (failure *rejectedPlanError) Unwrap() error { return failure.cause }

func (manager *Manager) acknowledge(ctx context.Context, tunnelPlan plan.Plan) error {
	err := manager.acknowledgeTargetPlans(ctx, tunnelPlan)
	manager.acknowledgementPending = err != nil
	return err
}

func (manager *Manager) acknowledgeTargetPlans(ctx context.Context, tunnelPlan plan.Plan) error {
	var failures []error
	for _, binding := range tunnelPlan.Bindings {
		acknowledgementContext, cancel := context.WithTimeout(ctx, tunnelControlTimeout)
		err := manager.control.AcknowledgeTargetPlan(
			acknowledgementContext,
			binding,
		)
		cancel()
		if err == nil {
			continue
		}
		if fencedControlError(err) {
			manager.log.DebugContext(ctx, "Machine target plan was superseded before acknowledgement", "edge_id", binding.EdgeID, "error", err)
			continue
		}
		failures = append(failures, fmt.Errorf("acknowledge target plan for Edge %s: %w", binding.EdgeID, err))
	}
	return errors.Join(failures...)
}

func (manager *Manager) install(ctx context.Context, tunnelPlan plan.Plan) error {
	manager.planMu.Lock()
	defer manager.planMu.Unlock()
	if current := manager.current.Load(); current != nil {
		if tunnelPlan.Version < current.Version {
			return fmt.Errorf("machine tunnel plan version %d would roll back version %d", tunnelPlan.Version, current.Version)
		}
		if tunnelPlan.Version == current.Version && tunnelPlan.Digest != current.Digest {
			return fmt.Errorf("machine tunnel plan version %d changed content", tunnelPlan.Version)
		}
		if tunnelPlan.Version == current.Version {
			return nil
		}
	}
	manager.current.Store(&tunnelPlan)
	manager.reconcile(ctx, tunnelPlan)
	return nil
}

func (manager *Manager) expirePlan(now time.Time) {
	manager.planMu.Lock()
	defer manager.planMu.Unlock()
	current := manager.current.Load()
	if current == nil || current.ValidAt(now) {
		return
	}
	if manager.current.CompareAndSwap(current, nil) {
		manager.log.Warn("Machine tunnel plan expired; closing all tunnels", "version", current.Version)
		manager.closeTunnels()
	}
}
