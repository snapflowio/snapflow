// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"context"
	"errors"
	"net/http"

	"github.com/snapflowio/snapshot-manager/internal/access"
)

type completion struct {
	service  *Service
	lifetime context.Context
}

func (c completion) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	service := c.service
	owned, ok := service.ownedRecord(w, r, service.limits.complete)
	if !ok {
		return
	}
	if _, ok := service.authorize(w, r, access.PushAccess(owned.Repository)); !ok {
		return
	}
	switch owned.State {
	case stateLinked:
		service.respond(w, r, http.StatusOK, statusOf(owned))
	case stateFailed:
		service.fail(w, r, http.StatusConflict, errors.New(owned.Error))
	default:
		c.startVerification(w, r, owned)
	}
}

func (c completion) startVerification(w http.ResponseWriter, r *http.Request, owned record) {
	service := c.service
	verifying := owned
	verifying.State = stateVerifying
	present, err := service.exists(r.Context(), stagedDataPath(owned.ID))
	if err != nil {
		service.failInternal(w, r, err)
		return
	}
	if !present {
		service.fail(w, r, http.StatusConflict, errDataMissing)
		return
	}
	if !service.tracker.startVerifying(owned.ID) {
		service.respond(w, r, http.StatusAccepted, statusOf(verifying))
		return
	}
	if err := service.saveRecord(r.Context(), verifying); err != nil {
		service.tracker.finishVerifying(owned.ID)
		service.failInternal(w, r, err)
		return
	}
	go service.verify(c.lifetime, verifying) //nolint:contextcheck // verification outlives the request and stops with the server
	service.respond(w, r, http.StatusAccepted, statusOf(verifying))
}
