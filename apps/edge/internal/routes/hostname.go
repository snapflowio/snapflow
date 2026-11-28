// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"net"
	"strconv"
	"strings"
)

const (
	maximumDNSLabelLength    = 63
	maximumHostnameLength    = 253
	hostnameLabelSeparator   = "."
	hostnamePortSeparator    = ":"
	hostnameLabelHyphen      = '-'
	portNumberBase           = 10
	portNumberBits           = 16
	rootPath                 = "/"
	pathSegmentSeparatorByte = '/'
)

func NormalizeHost(value string) string {
	host := strings.TrimSpace(strings.ToLower(value))
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}
	return strings.TrimSuffix(host, hostnameLabelSeparator)
}

func IsValidHostname(value string) bool {
	hostname, valid := stripHostnamePort(strings.TrimSpace(strings.ToLower(value)))
	if !valid {
		return false
	}
	hostname = strings.TrimSuffix(hostname, hostnameLabelSeparator)
	if hostname == "" || len(hostname) > maximumHostnameLength {
		return false
	}
	for label := range strings.SplitSeq(hostname, hostnameLabelSeparator) {
		if !isValidDNSLabel(label) {
			return false
		}
	}
	return true
}

func stripHostnamePort(hostname string) (string, bool) {
	if !strings.Contains(hostname, hostnamePortSeparator) {
		return hostname, true
	}
	parsedHost, port, err := net.SplitHostPort(hostname)
	if err != nil {
		return "", false
	}
	parsedPort, err := strconv.ParseUint(port, portNumberBase, portNumberBits)
	if err != nil || parsedPort == 0 {
		return "", false
	}
	return parsedHost, true
}

func isValidDNSLabel(label string) bool {
	if len(label) == 0 || len(label) > maximumDNSLabelLength ||
		label[0] == hostnameLabelHyphen || label[len(label)-1] == hostnameLabelHyphen {
		return false
	}
	for _, character := range label {
		if (character < 'a' || character > 'z') &&
			(character < '0' || character > '9') && character != hostnameLabelHyphen {
			return false
		}
	}
	return true
}

func PathMatches(prefix, path string) bool {
	if prefix == rootPath {
		return strings.HasPrefix(path, rootPath)
	}
	if path == prefix {
		return true
	}
	return strings.HasPrefix(path, prefix) &&
		len(path) > len(prefix) &&
		path[len(prefix)] == pathSegmentSeparatorByte
}
