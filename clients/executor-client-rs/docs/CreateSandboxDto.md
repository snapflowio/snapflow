# CreateSandboxDto

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**buckets** | Option<[**Vec<models::BucketDto>**](BucketDTO.md)> |  | [optional]
**cpu_quota** | **i32** |  | 
**entrypoint** | Option<**Vec<String>**> |  | [optional]
**env** | Option<**std::collections::HashMap<String, String>**> |  | [optional]
**gpu_quota** | Option<**i32**> |  | [optional]
**id** | **String** |  | 
**image** | **String** |  | 
**labels** | Option<**std::collections::HashMap<String, String>**> |  | [optional]
**memory_quota** | **i32** |  | 
**metadata** | Option<**std::collections::HashMap<String, String>**> |  | [optional]
**network_allow_list** | Option<**Vec<String>**> |  | [optional]
**network_block_all** | Option<**bool**> |  | [optional]
**os_user** | **String** |  | 
**registry** | Option<[**models::RegistryDto**](RegistryDTO.md)> |  | [optional]
**storage_quota** | **i32** |  | 
**user_id** | **String** |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


