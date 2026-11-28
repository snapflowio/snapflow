vault {
  address = "http://openbao:8200"

  retry {
    num_retries = 5
  }
}

auto_auth {
  method {
    type = "token_file"

    config = {
      token_file_path = "/run/snapflow-openbao/api-token"
    }
  }

  sink "file" {
    config = {
      path = "/tmp/snapflow-openbao-proxy-token"
      mode = 0600
    }
  }
}

api_proxy {
  use_auto_auth_token = "force"
}

listener "tcp" {
  address                = "0.0.0.0:8201"
  tls_disable            = true
  require_request_header = true
}
