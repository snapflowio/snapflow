// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import "github.com/distribution/distribution/v3/configuration"

const storageInfoDriverKey = "driver"

func storageInfo(storage configuration.Storage) map[string]any {
	driver := storage.Type()
	params := storage.Parameters()
	info := map[string]any{storageInfoDriverKey: driver}

	switch driver {
	case StorageDriverFilesystem:
		info[storageParamRootDir] = params[storageParamRootDir]
	case StorageDriverS3:
		info[storageParamRegion] = params[storageParamRegion]
		info[storageParamBucket] = params[storageParamBucket]
	}
	return info
}
