// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::{
    body::Body,
    extract::Request,
    http::{StatusCode, header},
    middleware::Next,
    response::{Html, IntoResponse, Response},
};

// If this header is present, skip the preview warning page
const SKIP_WARNING_HEADER: &str = "X-Snapflow-Skip-Preview-Warning";

// Cookie used to determine if the actual warning was accepted
const ACCEPT_COOKIE_NAME: &str = "snapflow-preview-page-accepted";

// How long the accept cookie will last
const ACCEPT_COOKIE_MAX_AGE: u32 = 86400; // 1 day
const ACCEPT_PATH: &str = "/accept-snapflow-preview-warning";

pub async fn warning_middleware(req: Request, next: Next) -> Response {
    if req
        .headers()
        .get(SKIP_WARNING_HEADER)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v == "true")
    {
        return next.run(req).await;
    }

    let ua = req
        .headers()
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !is_browser_request(ua) {
        return next.run(req).await;
    }

    if is_websocket_upgrade(&req) {
        return next.run(req).await;
    }

    if has_accepted_warning(&req) {
        return next.run(req).await;
    }

    let path = req.uri().path();
    if path == ACCEPT_PATH
        || path == "/callback"
        || path == "/health"
        || path.starts_with("/toolbox/")
    {
        return next.run(req).await;
    }

    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if let Some(port) = host
        .split('.')
        .next()
        .and_then(|s| s.split_once('-'))
        .map(|(p, _)| p)
        && (port == "22222" || port == "2280" || port == "6080")
    {
        return next.run(req).await;
    }

    let protocol = if req.uri().scheme_str().is_some_and(|s| s == "https") {
        "https"
    } else {
        "http"
    };

    let full_url = format!("{protocol}://{host}{}", req.uri());
    serve_warning_page(&full_url)
}

pub async fn handle_accept_warning(req: Request<Body>) -> Response {
    let secure = req.uri().scheme_str().is_some_and(|s| s == "https");

    let redirect_url = req
        .uri()
        .query()
        .and_then(|q| {
            url::form_urlencoded::parse(q.as_bytes())
                .find(|(k, _)| k == "redirect")
                .map(|(_, v)| v.into_owned())
        })
        .unwrap_or_else(|| "/".to_string());

    let redirect_url = if is_safe_redirect(&redirect_url) {
        redirect_url
    } else {
        "/".to_string()
    };

    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");

    let same_site = if secure { "None" } else { "Lax" };
    let secure_flag = if secure { "; Secure" } else { "" };
    let domain_part = if host.ends_with(".localhost") || host == "localhost" {
        String::default()
    } else {
        format!("; Domain={host}")
    };
    let cookie = format!(
        "{ACCEPT_COOKIE_NAME}=true; Max-Age={ACCEPT_COOKIE_MAX_AGE}; Path=/{domain_part}; HttpOnly; SameSite={same_site}{secure_flag}"
    );

    Response::builder()
        .status(StatusCode::FOUND)
        .header(header::LOCATION, &redirect_url)
        .header(header::SET_COOKIE, &cookie)
        .body(Body::empty())
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build redirect",
            )
                .into_response()
        })
}

fn is_browser_request(ua: &str) -> bool {
    if ua.is_empty() {
        return false;
    }

    if let Some(result) = woothee::parser::Parser::default().parse(ua) {
        result.category == "pc"
            || result.category == "smartphone"
            || result.category == "mobilephone"
    } else {
        false
    }
}

fn is_websocket_upgrade(req: &Request) -> bool {
    req.headers()
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.eq_ignore_ascii_case("websocket"))
}

const ACCEPT_COOKIE_VALUE: &str = concat!("snapflow-preview-page-accepted", "=true");

fn has_accepted_warning(req: &Request) -> bool {
    req.headers()
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|cookies| {
            cookies
                .split(';')
                .any(|part| part.trim() == ACCEPT_COOKIE_VALUE)
        })
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

fn is_safe_redirect(url: &str) -> bool {
    url.starts_with('/') && !url.starts_with("//")
}

fn serve_warning_page(full_url: &str) -> Response {
    let escaped_url = html_escape(full_url);
    let action_url = html_escape(&format!(
        "{ACCEPT_PATH}?redirect={}",
        url::form_urlencoded::byte_serialize(full_url.as_bytes()).collect::<String>()
    ));

    let html = format!(
        r##"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Preview Warning - Snapflow</title>
  <style>
    *, *::before, *::after {{ margin: 0; padding: 0; box-sizing: border-box; }}

    :root {{
      --bg: #1b1b1b;
      --surface-1: #1e1e1e;
      --surface-2: #232323;
      --surface-4: #292929;
      --surface-6: #454545;
      --text-primary: #e6e6e6;
      --text-secondary: #cccccc;
      --text-muted: #787878;
      --text-body: #cdcdcd;
      --border: #333333;
      --border-1: #3d3d3d;
      --warning: #ff6600;
    }}

    body {{
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }}

    .wrapper {{
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }}

    .card {{
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      max-width: 420px;
      width: 100%;
      overflow: hidden;
    }}

    .body {{
      padding: 1.25rem 1rem 1rem;
    }}

    .icon {{
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 0.375rem;
      background: rgba(255, 102, 0, 0.08);
      border: 1px solid rgba(255, 102, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.875rem;
    }}

    .icon svg {{
      width: 0.8125rem;
      height: 0.8125rem;
      color: var(--warning);
    }}

    .title {{
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }}

    .subtitle {{
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
      line-height: 1.5;
      word-break: break-all;
    }}

    .subtitle strong {{
      color: var(--text-body);
      font-weight: 500;
    }}

    .notice {{
      font-size: 0.8125rem;
      color: var(--text-secondary);
      line-height: 1.6;
      padding: 0.625rem 0.75rem;
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: 0.375rem;
    }}

    .notice ul {{
      list-style: none;
      padding: 0;
    }}

    .notice li {{
      padding-left: 0.75rem;
      position: relative;
    }}

    .notice li::before {{
      content: "";
      position: absolute;
      left: 0;
      top: 0.6em;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--text-muted);
    }}

    .footer {{
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--border);
      background: var(--surface-2);
      border-radius: 0 0 0.5rem 0.5rem;
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 1.75rem;
      padding: 0 0.625rem;
      border-radius: 5px;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
      font-family: inherit;
    }}

    .btn-close, .btn-continue {{
      border: 1px solid var(--border-1);
      background: var(--surface-4);
      color: var(--text-body);
    }}

    .btn-close:hover, .btn-continue:hover {{
      background: var(--surface-6);
      color: var(--text-primary);
    }}

    .powered {{
      padding: 0.75rem;
      text-align: center;
      font-size: 0.6875rem;
      color: var(--text-muted);
    }}

    @media (max-width: 640px) {{
      .body {{ padding: 1rem; }}
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="body">
        <div class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
        </div>
        <h1 class="title">Preview Warning</h1>
        <p class="subtitle">You are about to open <strong>{escaped_url}</strong></p>
        <div class="notice">
          <ul>
            <li>This content runs in a Snapflow sandbox</li>
            <li>It was created by another user, not by Snapflow</li>
            <li>Avoid entering sensitive information</li>
          </ul>
        </div>
      </div>
      <div class="footer">
        <button class="btn btn-close" onclick="window.close()">Close</button>
        <form action="{action_url}" method="POST">
          <button type="submit" class="btn btn-continue">Continue</button>
        </form>
      </div>
    </div>
  </div>
  <div class="powered">Powered by Snapflow</div>
</body>
</html>"##
    );

    Html(html).into_response()
}
