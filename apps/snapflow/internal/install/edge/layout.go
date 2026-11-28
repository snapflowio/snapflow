// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/supplychain/tuf"
)

const (
	ServiceUnit     = "snapflow-edge.service"
	UpdateUnit      = "snapflow-edge-update.service"
	UpdateTimerUnit = "snapflow-edge-update.timer"

	installationRoot    = "/opt/snapflow-edge"
	releasesDirectory   = "releases"
	currentLinkName     = "current"
	stateFileName       = "release.json"
	releaseStateRoot    = "/var/lib/snapflow-edge-release"
	environmentFile     = "/etc/snapflow-edge/edge.env"
	unitDirectory       = "/etc/systemd/system"
	directoryMode       = fs.FileMode(0o755)
	privateDirectory    = fs.FileMode(0o700)
	binaryMode          = fs.FileMode(0o755)
	unitMode            = fs.FileMode(0o644)
	secretMode          = fs.FileMode(0o600)
	healthAddress       = "127.0.0.1:443"
	healthTimeout       = 90 * time.Second
	healthPollInterval  = 2 * time.Second
	requiredAPIBasePath = "/api"
	tcpNetwork          = "tcp"
)

//go:embed files
var unitFiles embed.FS

func units() []string {
	return []string{ServiceUnit, UpdateUnit, UpdateTimerUnit}
}

type Settings struct {
	Channel          tuf.Channel
	APIURL           string
	EdgeID           string
	EnrollmentSecret string
	OriginSite       string
	OriginHosts      string
}

func (settings Settings) Validate() error {
	apiURL, err := url.Parse(settings.APIURL)
	if err != nil || apiURL.Scheme != "https" || apiURL.Host == "" ||
		strings.TrimRight(apiURL.Path, "/") != requiredAPIBasePath {
		return fmt.Errorf("the API URL must be an https URL ending in %s", requiredAPIBasePath)
	}
	if uuid.Validate(settings.EdgeID) != nil {
		return errors.New("the edge ID must be a UUID")
	}
	if strings.TrimSpace(settings.EnrollmentSecret) == "" {
		return errors.New("the enrollment secret is required")
	}
	if (settings.OriginSite == "") != (settings.OriginHosts == "") {
		return errors.New("the origin site and origin hosts go together")
	}
	if strings.ContainsAny(settings.EnrollmentSecret+settings.OriginSite+settings.OriginHosts, "\n\r") {
		return errors.New("settings must not contain line breaks")
	}
	return nil
}

func (settings Settings) environment() string {
	lines := []string{
		"SNAPFLOW_EDGE_API_URL=" + settings.APIURL,
		"SNAPFLOW_EDGE_ID=" + settings.EdgeID,
		"SNAPFLOW_EDGE_ENROLLMENT_SECRET=" + settings.EnrollmentSecret,
	}
	if settings.OriginSite != "" {
		lines = append(lines,
			"SNAPFLOW_EDGE_ORIGIN_SITE="+settings.OriginSite,
			"SNAPFLOW_EDGE_ORIGIN_HOSTS="+settings.OriginHosts,
		)
	}
	return strings.Join(lines, "\n") + "\n"
}

func releaseDirectory(identity string) string {
	return path.Join(installationRoot, releasesDirectory, identity)
}

func healthy(ctx context.Context, address string, timeout time.Duration) bool {
	dialer := net.Dialer{Timeout: timeout}
	connection, err := dialer.DialContext(ctx, tcpNetwork, address)
	if err != nil {
		return false
	}
	return connection.Close() == nil
}
