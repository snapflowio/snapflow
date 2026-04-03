// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use base64::Engine;
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use p256::elliptic_curve::sec1::ToEncodedPoint;
use serde::{Deserialize, Serialize};
use snapflow_models::SystemRole;
use uuid::Uuid;

// Access token: 15 minutes for security
const JWT_EXPIRY_MINUTES: i64 = 15;
// Refresh token: 30 days for convenience
pub const REFRESH_TOKEN_EXPIRY_DAYS: i64 = 30;

// Token issuer
const JWT_ISSUER: &str = "snapflow";

// What the token can be used for
const JWT_AUDIENCE: &str = "snapflow-api";

// The signing key
const JWT_KID: &str = "snapflow-signing-key";

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub role: SystemRole,
    pub iss: String,
    pub aud: String,
    pub iat: i64,
    pub exp: i64,
    /// JWT ID for token blacklisting and revocation
    pub jti: String,
}

pub struct JwtKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
    pub jwks: serde_json::Value,
}

impl JwtKeys {
    pub fn from_ec_pem(pem: &[u8]) -> anyhow::Result<Self> {
        let encoding = EncodingKey::from_ec_pem(pem)?;

        let pem_str = std::str::from_utf8(pem)?;
        let secret_key = pem_str
            .parse::<p256::SecretKey>()
            .map_err(|e| anyhow::anyhow!("failed to parse EC key: {e}"))?;
        let public_key = secret_key.public_key();
        let point = public_key.to_encoded_point(false);
        let decoding = DecodingKey::from_ec_der(&point.to_bytes());

        let x_coord = point
            .x()
            .ok_or_else(|| anyhow::anyhow!("EC public key missing x coordinate"))?;
        let y_coord = point
            .y()
            .ok_or_else(|| anyhow::anyhow!("EC public key missing y coordinate"))?;
        let x = base64_url_encode(x_coord);
        let y = base64_url_encode(y_coord);
        let jwks = serde_json::json!({
            "keys": [{
                "kid": JWT_KID,
                "kty": "EC",
                "crv": "P-256",
                "alg": "ES256",
                "use": "sig",
                "x": x,
                "y": y,
            }]
        });

        Ok(Self {
            encoding,
            decoding,
            jwks,
        })
    }

    pub fn sign(&self, user_id: Uuid, email: &str, role: SystemRole) -> anyhow::Result<String> {
        let now = Utc::now();
        let jti = Uuid::new_v4().to_string();
        let claims = Claims {
            sub: user_id,
            email: email.to_owned(),
            role,
            iss: JWT_ISSUER.to_owned(),
            aud: JWT_AUDIENCE.to_owned(),
            iat: now.timestamp(),
            exp: (now + Duration::minutes(JWT_EXPIRY_MINUTES)).timestamp(),
            jti,
        };
        let mut header = Header::new(Algorithm::ES256);
        header.kid = Some(JWT_KID.to_owned());
        encode(&header, &claims, &self.encoding).map_err(Into::into)
    }

    pub fn verify(&self, token: &str) -> anyhow::Result<Claims> {
        let mut validation = Validation::new(Algorithm::ES256);
        validation.set_required_spec_claims(&["sub", "exp", "iss", "aud"]);
        validation.set_issuer(&[JWT_ISSUER]);
        validation.set_audience(&[JWT_AUDIENCE]);
        let data = decode::<Claims>(token, &self.decoding, &validation)?;
        Ok(data.claims)
    }

    pub fn decoding_key(&self) -> &DecodingKey {
        &self.decoding
    }
}

pub fn es256_validation() -> Validation {
    let mut validation = Validation::new(Algorithm::ES256);
    validation.set_required_spec_claims(&["sub", "exp", "iss", "aud", "jti"]);
    validation.set_issuer(&[JWT_ISSUER]);
    validation.set_audience(&[JWT_AUDIENCE]);
    validation
}

fn base64_url_encode(bytes: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}
