# \ApiKeysAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateApiKey**](ApiKeysAPI.md#CreateApiKey) | **Post** /api-keys | Create API key
[**DeleteApiKey**](ApiKeysAPI.md#DeleteApiKey) | **Delete** /api-keys/{name} | Delete API key by name
[**GetApiKey**](ApiKeysAPI.md#GetApiKey) | **Get** /api-keys/{name} | Get API key by name
[**GetCurrentApiKey**](ApiKeysAPI.md#GetCurrentApiKey) | **Get** /api-keys/current | Get current API key&#39;s details
[**ListApiKeys**](ApiKeysAPI.md#ListApiKeys) | **Get** /api-keys | List API keys



## CreateApiKey

> ApiKeyResponse CreateApiKey(ctx).CreateApiKey(createApiKey).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create API key

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	createApiKey := *openapiclient.NewCreateApiKey("Test API Key", []string{"Permissions_example"}) // CreateApiKey | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ApiKeysAPI.CreateApiKey(context.Background()).CreateApiKey(createApiKey).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ApiKeysAPI.CreateApiKey``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateApiKey`: ApiKeyResponse
	fmt.Fprintf(os.Stdout, "Response from `ApiKeysAPI.CreateApiKey`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateApiKeyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createApiKey** | [**CreateApiKey**](CreateApiKey.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ApiKeyResponse**](ApiKeyResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteApiKey

> DeleteApiKey(ctx, name).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete API key by name

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	name := "name_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ApiKeysAPI.DeleteApiKey(context.Background(), name).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ApiKeysAPI.DeleteApiKey``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**name** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteApiKeyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetApiKey

> ApiKeyList GetApiKey(ctx, name).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get API key by name

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	name := "name_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ApiKeysAPI.GetApiKey(context.Background(), name).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ApiKeysAPI.GetApiKey``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetApiKey`: ApiKeyList
	fmt.Fprintf(os.Stdout, "Response from `ApiKeysAPI.GetApiKey`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**name** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetApiKeyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ApiKeyList**](ApiKeyList.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetCurrentApiKey

> ApiKeyList GetCurrentApiKey(ctx).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get current API key's details

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ApiKeysAPI.GetCurrentApiKey(context.Background()).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ApiKeysAPI.GetCurrentApiKey``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCurrentApiKey`: ApiKeyList
	fmt.Fprintf(os.Stdout, "Response from `ApiKeysAPI.GetCurrentApiKey`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetCurrentApiKeyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ApiKeyList**](ApiKeyList.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListApiKeys

> []ApiKeyList ListApiKeys(ctx).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

List API keys

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ApiKeysAPI.ListApiKeys(context.Background()).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ApiKeysAPI.ListApiKeys``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListApiKeys`: []ApiKeyList
	fmt.Fprintf(os.Stdout, "Response from `ApiKeysAPI.ListApiKeys`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListApiKeysRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]ApiKeyList**](ApiKeyList.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

