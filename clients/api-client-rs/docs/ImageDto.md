# ImageDto

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**organization_id** | Option<**String**> |  | [optional]
**general** | **bool** |  | 
**name** | **String** |  | 
**image_name** | Option<**String**> |  | [optional]
**state** | [**models::ImageState**](ImageState.md) |  | 
**size** | Option<**f64**> |  | 
**entrypoint** | Option<**Vec<String>**> |  | 
**cpu** | **f64** |  | 
**gpu** | **f64** |  | 
**mem** | **f64** |  | 
**disk** | **f64** |  | 
**error_reason** | Option<**String**> |  | 
**created_at** | **String** |  | 
**updated_at** | **String** |  | 
**last_used_at** | Option<**String**> |  | 
**build_info** | Option<[**models::BuildInfo**](BuildInfo.md)> | Build information for the image | [optional]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


