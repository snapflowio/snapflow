# \ImagesAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ActivateImage**](ImagesAPI.md#ActivateImage) | **Post** /images/{id}/activate | Activate a image
[**CreateImage**](ImagesAPI.md#CreateImage) | **Post** /images | Create a new image
[**GetAllImages**](ImagesAPI.md#GetAllImages) | **Get** /images | List all images
[**GetImage**](ImagesAPI.md#GetImage) | **Get** /images/{id} | Get image by ID or name
[**GetImageBuildLogs**](ImagesAPI.md#GetImageBuildLogs) | **Get** /images/{id}/build-logs | Get image build logs
[**RemoveImage**](ImagesAPI.md#RemoveImage) | **Delete** /images/{id} | Delete image
[**SetImageGeneralStatus**](ImagesAPI.md#SetImageGeneralStatus) | **Patch** /images/{id}/general | Set image general status
[**ToggleImageState**](ImagesAPI.md#ToggleImageState) | **Patch** /images/{id}/toggle | Toggle image state



## ActivateImage

> ImageDto ActivateImage(ctx, id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Activate a image

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
	id := "id_example" // string | Image ID
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ImagesAPI.ActivateImage(context.Background(), id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.ActivateImage``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ActivateImage`: ImageDto
	fmt.Fprintf(os.Stdout, "Response from `ImagesAPI.ActivateImage`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Image ID | 

### Other Parameters

Other parameters are passed through a pointer to a apiActivateImageRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ImageDto**](ImageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateImage

> ImageDto CreateImage(ctx).CreateImage(createImage).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create a new image

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
	createImage := *openapiclient.NewCreateImage("ubuntu-4vcpu-8ram-100gb") // CreateImage | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ImagesAPI.CreateImage(context.Background()).CreateImage(createImage).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.CreateImage``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateImage`: ImageDto
	fmt.Fprintf(os.Stdout, "Response from `ImagesAPI.CreateImage`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateImageRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createImage** | [**CreateImage**](CreateImage.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ImageDto**](ImageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetAllImages

> PaginatedImagesDto GetAllImages(ctx).XSnapflowOrganizationID(xSnapflowOrganizationID).Limit(limit).Page(page).Execute()

List all images

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
	limit := float32(8.14) // float32 | Number of items per page (optional)
	page := float32(8.14) // float32 | Page number (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ImagesAPI.GetAllImages(context.Background()).XSnapflowOrganizationID(xSnapflowOrganizationID).Limit(limit).Page(page).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.GetAllImages``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAllImages`: PaginatedImagesDto
	fmt.Fprintf(os.Stdout, "Response from `ImagesAPI.GetAllImages`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetAllImagesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **limit** | **float32** | Number of items per page | 
 **page** | **float32** | Page number | 

### Return type

[**PaginatedImagesDto**](PaginatedImagesDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetImage

> ImageDto GetImage(ctx, id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get image by ID or name

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
	id := "id_example" // string | Image ID or name
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ImagesAPI.GetImage(context.Background(), id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.GetImage``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetImage`: ImageDto
	fmt.Fprintf(os.Stdout, "Response from `ImagesAPI.GetImage`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Image ID or name | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetImageRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ImageDto**](ImageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetImageBuildLogs

> GetImageBuildLogs(ctx, id).XSnapflowOrganizationID(xSnapflowOrganizationID).Follow(follow).Execute()

Get image build logs

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
	id := "id_example" // string | Image ID
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)
	follow := true // bool | Whether to follow the logs stream (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ImagesAPI.GetImageBuildLogs(context.Background(), id).XSnapflowOrganizationID(xSnapflowOrganizationID).Follow(follow).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.GetImageBuildLogs``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Image ID | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetImageBuildLogsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **follow** | **bool** | Whether to follow the logs stream | 

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


## RemoveImage

> RemoveImage(ctx, id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete image

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
	id := "id_example" // string | Image ID
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ImagesAPI.RemoveImage(context.Background(), id).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.RemoveImage``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Image ID | 

### Other Parameters

Other parameters are passed through a pointer to a apiRemoveImageRequest struct via the builder pattern


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


## SetImageGeneralStatus

> ImageDto SetImageGeneralStatus(ctx, id).SetImageGeneralStatusDto(setImageGeneralStatusDto).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Set image general status

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
	id := "id_example" // string | Image ID
	setImageGeneralStatusDto := *openapiclient.NewSetImageGeneralStatusDto(true) // SetImageGeneralStatusDto | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ImagesAPI.SetImageGeneralStatus(context.Background(), id).SetImageGeneralStatusDto(setImageGeneralStatusDto).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.SetImageGeneralStatus``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SetImageGeneralStatus`: ImageDto
	fmt.Fprintf(os.Stdout, "Response from `ImagesAPI.SetImageGeneralStatus`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Image ID | 

### Other Parameters

Other parameters are passed through a pointer to a apiSetImageGeneralStatusRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **setImageGeneralStatusDto** | [**SetImageGeneralStatusDto**](SetImageGeneralStatusDto.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ImageDto**](ImageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ToggleImageState

> ImageDto ToggleImageState(ctx, id).ToggleState(toggleState).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Toggle image state

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
	id := "id_example" // string | Image ID
	toggleState := *openapiclient.NewToggleState(true) // ToggleState | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ImagesAPI.ToggleImageState(context.Background(), id).ToggleState(toggleState).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ImagesAPI.ToggleImageState``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ToggleImageState`: ImageDto
	fmt.Fprintf(os.Stdout, "Response from `ImagesAPI.ToggleImageState`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Image ID | 

### Other Parameters

Other parameters are passed through a pointer to a apiToggleImageStateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **toggleState** | [**ToggleState**](ToggleState.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ImageDto**](ImageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

