# \ImagesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**build_image**](ImagesApi.md#build_image) | **POST** /images/build | Build an image
[**get_build_logs**](ImagesApi.md#get_build_logs) | **GET** /images/logs | Get build logs
[**image_exists**](ImagesApi.md#image_exists) | **GET** /images/exists | Check if an image exists
[**pull_image**](ImagesApi.md#pull_image) | **POST** /images/pull | Pull an image
[**remove_image**](ImagesApi.md#remove_image) | **POST** /images/remove | Remove an image



## build_image

> String build_image(build_image_request_dto)
Build an image

Build an image from a Dockerfile and context hashes

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**build_image_request_dto** | [**BuildImageRequestDto**](BuildImageRequestDto.md) |  | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_build_logs

> String get_build_logs(image_ref, follow)
Get build logs

Stream build logs

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**image_ref** | **String** | Image ID or image ref without the tag | [required] |
**follow** | Option<**bool**> | Whether to follow the log output |  |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## image_exists

> models::ImageExistsResponse image_exists(image)
Check if an image exists

Check if a specified image exists locally

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**image** | **String** | Image name and tag | [required] |

### Return type

[**models::ImageExistsResponse**](ImageExistsResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## pull_image

> String pull_image(pull_image_request_dto)
Pull an image

Pull an image from a registry

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**pull_image_request_dto** | [**PullImageRequestDto**](PullImageRequestDto.md) |  | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## remove_image

> String remove_image(image)
Remove an image

Remove a specified image from the local system

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**image** | **String** | Image name and tag | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

