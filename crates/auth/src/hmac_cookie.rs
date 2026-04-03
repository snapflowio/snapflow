// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub fn sign(value: &str, key: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(value.as_bytes());
    let sig = hex::encode(mac.finalize().into_bytes());
    format!("{value}|{sig}")
}

pub fn verify(cookie_value: &str, key: &[u8]) -> Option<String> {
    let (value, sig_hex) = cookie_value.rsplit_once('|')?;
    let expected_sig = hex::decode(sig_hex).ok()?;

    let mut mac = HmacSha256::new_from_slice(key).ok()?;
    mac.update(value.as_bytes());
    mac.verify_slice(&expected_sig).ok()?;

    Some(value.to_owned())
}
