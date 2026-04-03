# \RegistryApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_registry**](RegistryApi.md#create_registry) | **POST** /registry | Create registry
[**delete_registry**](RegistryApi.md#delete_registry) | **DELETE** /registry/{id} | Delete registry
[**get_registry**](RegistryApi.md#get_registry) | **GET** /registry/{id} | Get registry
[**get_transient_push_access**](RegistryApi.md#get_transient_push_access) | **GET** /registry/registry-push-access | Get temporary registry access for pushing images
[**list_registries**](RegistryApi.md#list_registries) | **GET** /registry | List registries
[**set_default_registry**](RegistryApi.md#set_default_registry) | **POST** /registry/{id}/set-default | Set default registry
[**update_registry**](RegistryApi.md#update_registry) | **PATCH** /registry/{id} | Update registry



## create_registry

> models::Registry create_registry(create_registry, x_snapflow_organization_id)
Create registry

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_registry** | [**CreateRegistry**](CreateRegistry.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Registry**](Registry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_registry

> delete_registry(id, x_snapflow_organization_id)
Delete registry

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the container registry | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_registry

> models::Registry get_registry(id, x_snapflow_organization_id)
Get registry

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the registry | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Registry**](Registry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_transient_push_access

> models::RegistryPushAccess get_transient_push_access(x_snapflow_organization_id)
Get temporary registry access for pushing images

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::RegistryPushAccess**](RegistryPushAccess.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_registries

> Vec<models::Registry> list_registries(x_snapflow_organization_id)
List registries

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**Vec<models::Registry>**](Registry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## set_default_registry

> models::Registry set_default_registry(id, x_snapflow_organization_id)
Set default registry

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the container registry | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Registry**](Registry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_registry

> models::Registry update_registry(id, update_registry, x_snapflow_organization_id)
Update registry

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the registry | [required] |
**update_registry** | [**UpdateRegistry**](UpdateRegistry.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Registry**](Registry.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

