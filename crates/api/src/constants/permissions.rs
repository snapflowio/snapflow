// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub const WRITE_REGISTRIES: &str = "write:registries";
pub const DELETE_REGISTRIES: &str = "delete:registries";
pub const WRITE_IMAGES: &str = "write:images";
pub const DELETE_IMAGES: &str = "delete:images";
pub const WRITE_SANDBOXES: &str = "write:sandboxes";
pub const DELETE_SANDBOXES: &str = "delete:sandboxes";
pub const READ_BUCKETS: &str = "read:buckets";
pub const WRITE_BUCKETS: &str = "write:buckets";
pub const DELETE_BUCKETS: &str = "delete:buckets";

pub const ALL: &[&str] = &[
    WRITE_REGISTRIES,
    DELETE_REGISTRIES,
    WRITE_IMAGES,
    DELETE_IMAGES,
    WRITE_SANDBOXES,
    DELETE_SANDBOXES,
    READ_BUCKETS,
    WRITE_BUCKETS,
    DELETE_BUCKETS,
];
