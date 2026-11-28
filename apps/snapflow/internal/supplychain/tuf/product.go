// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"errors"
	"fmt"
	"strings"

	"github.com/snapflowio/snapflow/internal/supplychain/release"
)

type Product string

const (
	ProductRuntime Product = "runtime"
	ProductEdge    Product = "edge"

	edgeBundleName            = "snapflow-edge"
	edgeBundleExtension       = ".tar.gz"
	runtimeDownloadPattern    = ".snapflow-runtime-*.tar.zst"
	edgeDownloadPattern       = "." + edgeBundleName + "-*" + edgeBundleExtension
	runtimeDownloadHeadroom   = 10 * 1024 * 1024 * 1024
	edgeDownloadHeadroom      = 256 * 1024 * 1024
	maximumEdgeBundleBytes    = 256 * 1024 * 1024
	EdgeBinaryName            = edgeBundleName
	edgeChannelDocumentPrefix = "edge-"
)

func ParseProduct(value string) (Product, error) {
	switch Product(strings.TrimSpace(value)) {
	case ProductRuntime:
		return ProductRuntime, nil
	case ProductEdge:
		return ProductEdge, nil
	default:
		return "", errors.New("product must be runtime or edge")
	}
}

func (product Product) channelPath(channel Channel, architecture string) string {
	prefix := ""
	if product == ProductEdge {
		prefix = edgeChannelDocumentPrefix
	}
	return fmt.Sprintf("channels/%s/%s%s-%s%s", channel, prefix, releaseOS, architecture, metadataExtension)
}

func (product Product) assetPath(version, architecture string) string {
	if product == ProductEdge {
		return "v" + version + "/" + EdgeBundleFileName(version, architecture)
	}
	return release.BundleAssetPath(version, architecture)
}

func (product Product) downloadPattern() string {
	if product == ProductEdge {
		return edgeDownloadPattern
	}
	return runtimeDownloadPattern
}

func (product Product) downloadHeadroom() uint64 {
	if product == ProductEdge {
		return edgeDownloadHeadroom
	}
	return runtimeDownloadHeadroom
}

func (product Product) maximumBundleBytes() int64 {
	if product == ProductEdge {
		return maximumEdgeBundleBytes
	}
	return maximumBundleBytes
}

func (product Product) documentValue() Product {
	if product == ProductRuntime {
		return ""
	}
	return product
}

func EdgeBundleFileName(version, architecture string) string {
	return fmt.Sprintf("%s-%s-%s-%s%s", edgeBundleName, version, releaseOS, architecture, edgeBundleExtension)
}
