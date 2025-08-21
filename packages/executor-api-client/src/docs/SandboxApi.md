# SandboxApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**create**](#create) | **POST** /sandboxes | Create a sandbox|
|[**createBackup**](#createbackup) | **POST** /sandboxes/{sandboxId}/backup | Create sandbox backup|
|[**destroy**](#destroy) | **POST** /sandboxes/{sandboxId}/destroy | Destroy sandbox|
|[**info**](#info) | **GET** /sandboxes/{sandboxId} | Get sandbox info|
|[**removeDestroyed**](#removedestroyed) | **DELETE** /sandboxes/{sandboxId} | Remove a destroyed sandbox|
|[**resize**](#resize) | **POST** /sandboxes/{sandboxId}/resize | Resize sandbox|
|[**start**](#start) | **POST** /sandboxes/{sandboxId}/start | Start sandbox|
|[**stop**](#stop) | **POST** /sandboxes/{sandboxId}/stop | Stop sandbox|

# **create**
> string create(sandbox)

Create a sandbox

### Example

```typescript
import {
    SandboxApi,
    Configuration,
    CreateSandboxDTO
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandbox: CreateSandboxDTO; //Create sandbox

const { status, data } = await apiInstance.create(
    sandbox
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandbox** | **CreateSandboxDTO**| Create sandbox | |


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
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createBackup**
> string createBackup(sandbox)

Create sandbox backup

### Example

```typescript
import {
    SandboxApi,
    Configuration,
    CreateBackupDTO
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandboxId: string; //Sandbox ID (default to undefined)
let sandbox: CreateBackupDTO; //Create backup

const { status, data } = await apiInstance.createBackup(
    sandboxId,
    sandbox
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandbox** | **CreateBackupDTO**| Create backup | |
| **sandboxId** | [**string**] | Sandbox ID | defaults to undefined|


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
|**201** | Backup created |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **destroy**
> string destroy()

Destroy sandbox

### Example

```typescript
import {
    SandboxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandboxId: string; //Sandbox ID (default to undefined)

const { status, data } = await apiInstance.destroy(
    sandboxId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandboxId** | [**string**] | Sandbox ID | defaults to undefined|


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
|**200** | Sandbox destroyed |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **info**
> SandboxInfoResponse info()

Get sandbox info

### Example

```typescript
import {
    SandboxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandboxId: string; //Sandbox ID (default to undefined)

const { status, data } = await apiInstance.info(
    sandboxId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandboxId** | [**string**] | Sandbox ID | defaults to undefined|


### Return type

**SandboxInfoResponse**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Sandbox info |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **removeDestroyed**
> string removeDestroyed()

Remove a sandbox that has been previously destroyed

### Example

```typescript
import {
    SandboxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandboxId: string; //Sandbox ID (default to undefined)

const { status, data } = await apiInstance.removeDestroyed(
    sandboxId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandboxId** | [**string**] | Sandbox ID | defaults to undefined|


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
|**200** | Sandbox removed |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **resize**
> string resize(sandbox)

Resize sandbox

### Example

```typescript
import {
    SandboxApi,
    Configuration,
    ResizeSandboxDTO
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandboxId: string; //Sandbox ID (default to undefined)
let sandbox: ResizeSandboxDTO; //Resize sandbox

const { status, data } = await apiInstance.resize(
    sandboxId,
    sandbox
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandbox** | **ResizeSandboxDTO**| Resize sandbox | |
| **sandboxId** | [**string**] | Sandbox ID | defaults to undefined|


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
|**200** | Sandbox resized |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **start**
> string start()

Start sandbox

### Example

```typescript
import {
    SandboxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandboxId: string; //Sandbox ID (default to undefined)

const { status, data } = await apiInstance.start(
    sandboxId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandboxId** | [**string**] | Sandbox ID | defaults to undefined|


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
|**200** | Sandbox started |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **stop**
> string stop()

Stop sandbox

### Example

```typescript
import {
    SandboxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SandboxApi(configuration);

let sandboxId: string; //Sandbox ID (default to undefined)

const { status, data } = await apiInstance.stop(
    sandboxId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sandboxId** | [**string**] | Sandbox ID | defaults to undefined|


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
|**200** | Sandbox stopped |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**409** | Conflict |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

