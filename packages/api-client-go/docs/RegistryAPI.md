# \RegistryAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateRegistry**](RegistryAPI.md#CreateRegistry) | **Post** /registry | Create registry
[**DeleteRegistry**](RegistryAPI.md#DeleteRegistry) | **Delete** /registry/{id} | Delete registry
[**GetRegistry**](RegistryAPI.md#GetRegistry) | **Get** /registry/{id} | Get registry
[**GetTransientPushAccess**](RegistryAPI.md#GetTransientPushAccess) | **Get** /registry/registry-push-access | Get temporary registry access for pushing images
[**ListRegistries**](RegistryAPI.md#ListRegistries) | **Get** /registry | List registries
[**SetDefaultRegistry**](RegistryAPI.md#SetDefaultRegistry) | **Post** /registry/{id}/set-default | Set default registry
[**UpdateRegistry**](RegistryAPI.md#UpdateRegistry) | **Patch** /registry/{id} | Update registry



## CreateRegistry

> DockerRegistry CreateRegistry(ctx).CreateDockerRegistry(createDockerRegistry).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create registry

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
	createDockerRegistry := *openapiclient.NewCreateDockerRegistry("Name_example", "Url_example", "Username_example", "Password_example", "Project_example", "RegistryType_example", false) // CreateDockerRegistry | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RegistryAPI.CreateRegistry(context.Background()).CreateDockerRegistry(createDockerRegistry).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RegistryAPI.CreateRegistry``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateRegistry`: DockerRegistry
	fmt.Fprintf(os.Stdout, "Response from `RegistryAPI.CreateRegistry`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateRegistryRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createDockerRegistry** | [**CreateDockerRegistry**](CreateDockerRegistry.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**DockerRegistry**](DockerRegistry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteRegistry

> DeleteRegistry(ctx, id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete registry

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
	id := "id_example" // string | ID of the container registry
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.RegistryAPI.DeleteRegistry(context.Background(), id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RegistryAPI.DeleteRegistry``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | ID of the container registry | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteRegistryRequest struct via the builder pattern


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


## GetRegistry

> DockerRegistry GetRegistry(ctx, id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get registry

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
	id := "id_example" // string | ID of the registry
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RegistryAPI.GetRegistry(context.Background(), id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RegistryAPI.GetRegistry``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRegistry`: DockerRegistry
	fmt.Fprintf(os.Stdout, "Response from `RegistryAPI.GetRegistry`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | ID of the registry | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetRegistryRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**DockerRegistry**](DockerRegistry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetTransientPushAccess

> RegistryPushAccessDto GetTransientPushAccess(ctx).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get temporary registry access for pushing images

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
	resp, r, err := apiClient.RegistryAPI.GetTransientPushAccess(context.Background()).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RegistryAPI.GetTransientPushAccess``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetTransientPushAccess`: RegistryPushAccessDto
	fmt.Fprintf(os.Stdout, "Response from `RegistryAPI.GetTransientPushAccess`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetTransientPushAccessRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**RegistryPushAccessDto**](RegistryPushAccessDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListRegistries

> []DockerRegistry ListRegistries(ctx).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

List registries

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
	resp, r, err := apiClient.RegistryAPI.ListRegistries(context.Background()).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RegistryAPI.ListRegistries``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRegistries`: []DockerRegistry
	fmt.Fprintf(os.Stdout, "Response from `RegistryAPI.ListRegistries`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListRegistriesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]DockerRegistry**](DockerRegistry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SetDefaultRegistry

> DockerRegistry SetDefaultRegistry(ctx, id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Set default registry

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
	id := "id_example" // string | ID of the container registry
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RegistryAPI.SetDefaultRegistry(context.Background(), id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RegistryAPI.SetDefaultRegistry``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SetDefaultRegistry`: DockerRegistry
	fmt.Fprintf(os.Stdout, "Response from `RegistryAPI.SetDefaultRegistry`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | ID of the container registry | 

### Other Parameters

Other parameters are passed through a pointer to a apiSetDefaultRegistryRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**DockerRegistry**](DockerRegistry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateRegistry

> DockerRegistry UpdateRegistry(ctx, id).UpdateDockerRegistry(updateDockerRegistry).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Update registry

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
	id := "id_example" // string | ID of the docker registry
	updateDockerRegistry := *openapiclient.NewUpdateDockerRegistry("Name_example", "Username_example") // UpdateDockerRegistry | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RegistryAPI.UpdateRegistry(context.Background(), id).UpdateDockerRegistry(updateDockerRegistry).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RegistryAPI.UpdateRegistry``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateRegistry`: DockerRegistry
	fmt.Fprintf(os.Stdout, "Response from `RegistryAPI.UpdateRegistry`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | ID of the docker registry | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateRegistryRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **updateDockerRegistry** | [**UpdateDockerRegistry**](UpdateDockerRegistry.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**DockerRegistry**](DockerRegistry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

