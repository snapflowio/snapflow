// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

const (
	FlagEdgeAPIURL      = "API base URL the edge talks to, ending in /api"
	FlagEdgeID          = "edge ID from Admin, Edges"
	FlagEdgeOriginSite  = "origin site whose tunnels this edge accepts; empty disables passthrough"
	FlagEdgeOriginHosts = "comma-separated server names passed through to the origin"
	EdgeUpdated         = "Updated the edge to %s.\n"
	EdgeCurrent         = "The edge is current.\n"
	EdgeInstalled       = "Installed the edge on the %s channel; it serves on this machine now.\n"
	EdgeStatusLine      = "Edge %s on the %s channel: %s (%s)\n"
)

func HelpEdge() Help {
	return Help{
		Use:   "edge",
		Short: "Install, update and inspect a standalone Snapflow edge on this machine",
		Long: `Edge commands run a Snapflow edge as a systemd service. The edge binary comes
from the same signed release channels as Snapflow itself and updates on a timer.`,
	}
}

func HelpEdgeInstall() Help {
	return Help{
		Use:   "install",
		Short: "Install the edge from a release channel and start it",
		Long: `Install verifies the newest edge release on the channel, installs it under
/opt/snapflow-edge, writes /etc/snapflow-edge/edge.env and the systemd units, and
starts the edge. The enrollment secret is read from SNAPFLOW_EDGE_ENROLLMENT_SECRET.`,
		Example: `  sudo SNAPFLOW_EDGE_ENROLLMENT_SECRET=... snapflow edge install \
    --api-url https://snapflow.io/api --edge-id 6f1c... \
    --origin-site titan --origin-hosts snapflow.io,registry.snapflow.io`,
	}
}

func HelpEdgeUpdate() Help {
	return Help{
		Use:   "update",
		Short: "Install a newer edge release when the channel offers one",
		Long: `Update moves the edge to the newest release on its channel and restarts it. If
the new release does not serve HTTPS within a minute and a half it restores the
previous release.`,
	}
}

func HelpEdgeStatus() Help {
	return Help{
		Use:   "status",
		Short: "Show the installed edge release and its service state",
	}
}
