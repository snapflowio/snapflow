# ImagesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**buildImage**](#buildimage) | **POST** /images/build | Build a image|
|[**getBuildLogs**](#getbuildlogs) | **GET** /images/logs | Get build logs|
|[**imageExists**](#imageexists) | **GET** /images/exists | Check if a image exists|
|[**pullImage**](#pullimage) | **POST** /images/pull | Pull a image|
|[**removeImage**](#removeimage) | **POST** /images/remove | Remove a image|

# **buildImage**
> string buildImage(request)

Build a image from a Dockerfile and context hashes

### Example

```typescript
import {
    ImagesApi,
    Configuration,
    BuildImageRequestDTO
} from './api';

const configuration = new Configuration();
const apiInstance = new ImagesApi(configuration);

let request: BuildImageRequestDTO; //Build image request

const { status, data } = await apiInstance.buildImage(
    request
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **request** | **BuildImageRequestDTO**| Build image request | |


### Return type

**string**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: */*


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image successfully built |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getBuildLogs**
> string getBuildLogs()

Stream build logs

### Example

```typescript
import {
    ImagesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ImagesApi(configuration);

let imageRef: string; //Image ID or image ref without the tag (default to undefined)
let follow: boolean; //Whether to follow the log output (optional) (default to undefined)

const { status, data } = await apiInstance.getBuildLogs(
    imageRef,
    follow
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageRef** | [**string**] | Image ID or image ref without the tag | defaults to undefined|
| **follow** | [**boolean**] | Whether to follow the log output | (optional) defaults to undefined|


### Return type

**string**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: */*


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Build logs stream |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageExists**
> ImageExistsResponse imageExists()

Check if a specified image exists locally

### Example

```typescript
import {
    ImagesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ImagesApi(configuration);

let image: string; //Image name and tag (default to undefined)

const { status, data } = await apiInstance.imageExists(
    image
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **image** | [**string**] | Image name and tag | defaults to undefined|


### Return type

**ImageExistsResponse**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pullImage**
> string pullImage(request)

Pull a image from a registry

### Example

```typescript
import {
    ImagesApi,
    Configuration,
    PullImageRequestDTO
} from './api';

const configuration = new Configuration();
const apiInstance = new ImagesApi(configuration);

let request: PullImageRequestDTO; //Pull image

const { status, data } = await apiInstance.pullImage(
    request
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **request** | **PullImageRequestDTO**| Pull image | |


### Return type

**string**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: */*


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image successfully pulled |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **removeImage**
> string removeImage()

Remove a specified image from the local system

### Example

```typescript
import {
    ImagesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ImagesApi(configuration);

let image: string; //Image name and tag (default to undefined)

const { status, data } = await apiInstance.removeImage(
    image
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **image** | [**string**] | Image name and tag | defaults to undefined|


### Return type

**string**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image successfully removed |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

