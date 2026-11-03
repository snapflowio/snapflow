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
	"sync"
	"time"

	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	sessionCloseCode     = 0
	sessionClosedReason  = "edge tunnel session closed"
	sessionStoppedReason = "edge tunnel session stopping"
	sessionWorkerCount   = 2
)

var (
	errEdgeDraining              = errors.New("edge is draining")
	errEdgeDrainingDuringConnect = errors.New("edge began draining during tunnel handshake")
	errMachineAuthentication     = errors.New("machine tunnel authentication failed")
)

func (registry *Registry) serve(
	parent context.Context,
	session *transport.Session,
) (resultErr error) {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()
	var closeOnce sync.Once
	var closeErr error
	closeSession := func(reason string) {
		closeOnce.Do(func() {
			closeErr = session.Close(sessionCloseCode, reason)
		})
	}
	defer func() {
		closeSession(sessionClosedReason)
		if closeErr != nil {
			resultErr = errors.Join(resultErr, closeErr)
		}
	}()
	controlStream, hello, err := session.ServerHandshake(
		ctx,
		func(hello protocol.ClientHello) (protocol.ServerHello, error) {
			return registry.authenticate(session, hello)
		},
	)
	if err != nil {
		return err
	}
	if registry.draining.Load() {
		return errEdgeDrainingDuringConnect
	}
	releaseHandshake(session)
	sessionContext, sessionCancel := context.WithCancel(ctx)
	active := &machineSession{
		machineID:                hello.MachineID,
		machineSessionGeneration: hello.MachineSessionGeneration,
		sessionID:                hello.SessionID,
		transport:                session,
		cancel:                   sessionCancel,
		binding:                  hello.Binding,
	}
	if err := registry.install(active); err != nil {
		return err
	}
	defer registry.remove(active)
	return registry.runSessionWorkers(parent, sessionContext, active, controlStream, closeSession)
}

func (registry *Registry) authenticate(
	session *transport.Session,
	hello protocol.ClientHello,
) (protocol.ServerHello, error) {
	if registry.draining.Load() {
		return protocol.ServerHello{}, errEdgeDraining
	}
	certificate, err := session.VerifiedPeerCertificate()
	if err != nil {
		return protocol.ServerHello{}, fmt.Errorf("read Machine tunnel certificate: %w", err)
	}
	peer, err := protocol.ParseMachineCertificate(certificate)
	if err != nil || peer.MachineID != hello.MachineID ||
		peer.EdgeID != registry.edgeID ||
		peer.MachineSessionGeneration != hello.MachineSessionGeneration ||
		peer.BindingID != hello.Binding.ID ||
		peer.BindingRevision != hello.Binding.Revision ||
		!registry.routes.Load().HasBinding(
			hello.MachineID,
			hello.MachineSessionGeneration,
			hello.Binding,
			time.Now(),
		) {
		return protocol.ServerHello{}, errMachineAuthentication
	}
	return protocol.ServerHello{
		Version: protocol.Version,
		EdgeID:  registry.edgeID.String(),
	}, nil
}

func (registry *Registry) runSessionWorkers(
	parent context.Context,
	sessionContext context.Context,
	active *machineSession,
	controlStream transport.Stream,
	closeSession func(string),
) error {
	reassembler, err := protocol.NewReassembler(protocol.DefaultReassemblerConfig())
	if err != nil {
		return fmt.Errorf("initialize edge UDP reassembler: %w", err)
	}
	dispatcher, err := registry.newDatagramDispatcher(sessionContext, active)
	if err != nil {
		return fmt.Errorf("initialize edge UDP dispatcher: %w", err)
	}
	defer dispatcher.Close()
	errs := make(chan error, sessionWorkerCount)
	go func() {
		errs <- registry.readHeartbeats(sessionContext, active, controlStream)
	}()
	go func() {
		errs <- registry.readDatagrams(sessionContext, active, reassembler, dispatcher)
	}()
	var selectedErr error
	remainingWorkers := sessionWorkerCount
	select {
	case <-parent.Done():
		selectedErr = parent.Err()
	case <-sessionContext.Done():
		selectedErr = sessionContext.Err()
	case err := <-errs:
		selectedErr = err
		remainingWorkers--
	}
	active.cancel()
	closeSession(sessionStoppedReason)
	// The remaining workers stop because the session was just cancelled, so
	// their errors describe the shutdown, not its cause.
	for ; remainingWorkers > 0; remainingWorkers-- {
		if err := <-errs; err != nil {
			registry.logger.Debug("Machine tunnel session worker stopped", "session_id", active.sessionID, "error", err)
		}
	}
	return selectedErr
}
