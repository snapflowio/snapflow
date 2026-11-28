// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import "net/http"

func (service *Service) status(w http.ResponseWriter, r *http.Request) {
	owned, ok := service.ownedRecord(w, r, service.limits.status)
	if !ok {
		return
	}
	if owned.State == stateVerifying && !service.tracker.isVerifying(owned.ID) {
		owned.State = statePending
	}
	service.respond(w, r, http.StatusOK, statusOf(owned))
}
