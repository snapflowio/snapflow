// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Once;

use anyhow::{Context, Result};
use hudsucker::certificate_authority::RcgenAuthority;
use hudsucker::rcgen::{
    BasicConstraints, CertificateParams, DistinguishedName, DnType, IsCa, KeyPair,
};
use hudsucker::rustls::crypto::aws_lc_rs;

static ENV_INIT: Once = Once::new();

pub struct CaConfig {
    pub authority: RcgenAuthority,
    pub ca_cert_pem: String,
}

pub fn generate_ca() -> Result<CaConfig> {
    let ca_key = KeyPair::generate().context("failed to generate CA key pair")?;

    let mut params = CertificateParams::default();
    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    let mut dn = DistinguishedName::default();
    dn.push(DnType::CommonName, "Snapflow Sandbox Proxy CA");
    dn.push(DnType::OrganizationName, "Snapflow");
    params.distinguished_name = dn;

    let ca_cert = params
        .self_signed(&ca_key)
        .context("failed to self-sign CA certificate")?;

    let ca_cert_pem = ca_cert.pem();
    let ca_key_pem = ca_key.serialize_pem();

    let key_pair = KeyPair::from_pem(&ca_key_pem).context("failed to parse CA key PEM")?;
    let issuer = hudsucker::rcgen::Issuer::from_ca_cert_pem(&ca_cert_pem, key_pair)
        .context("failed to create issuer from CA cert")?;

    let authority = RcgenAuthority::new(issuer, 1_000, aws_lc_rs::default_provider());

    Ok(CaConfig {
        authority,
        ca_cert_pem,
    })
}

pub async fn install_ca_cert(pem: &str) -> Result<()> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let cert_dir = format!("{home}/.snapflow/certs");
    tokio::fs::create_dir_all(&cert_dir)
        .await
        .context("failed to create cert directory")?;

    let cert_path = format!("{cert_dir}/snapflow-ca.crt");
    tokio::fs::write(&cert_path, pem)
        .await
        .context("failed to write CA certificate")?;

    let system_bundle = find_system_ca_bundle().await;
    let combined_path = format!("{cert_dir}/ca-bundle.crt");

    let mut combined = String::default();
    if let Some(ref bundle) = system_bundle
        && let Ok(contents) = tokio::fs::read_to_string(bundle).await
    {
        combined.push_str(&contents);
    }
    combined.push_str(pem);

    tokio::fs::write(&combined_path, &combined)
        .await
        .context("failed to write combined CA bundle")?;

    let combined_path_clone = combined_path.clone();
    let cert_path_clone = cert_path.clone();

    ENV_INIT.call_once(|| unsafe {
        std::env::set_var("SSL_CERT_FILE", &combined_path_clone);
        std::env::set_var("REQUESTS_CA_BUNDLE", &combined_path_clone);
        std::env::set_var("NODE_EXTRA_CA_CERTS", &cert_path_clone);
        std::env::set_var("CURL_CA_BUNDLE", &combined_path_clone);
    });

    tracing::info!(path = %combined_path, "installed MITM CA certificate");
    Ok(())
}

async fn find_system_ca_bundle() -> Option<String> {
    let candidates = [
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/pki/tls/certs/ca-bundle.crt",
        "/etc/ssl/ca-bundle.pem",
        "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
    ];
    for path in candidates {
        if tokio::fs::metadata(path).await.is_ok() {
            return Some(path.to_string());
        }
    }
    None
}
