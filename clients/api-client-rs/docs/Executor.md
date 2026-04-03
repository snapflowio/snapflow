# Executor

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**api_key** | **String** |  | 
**api_url** | **String** |  | 
**availability_score** | **i32** |  | 
**capacity** | **i32** |  | 
**class** | [**models::SandboxClass**](SandboxClass.md) |  | 
**cpu** | **i32** |  | 
**created_at** | **String** |  | 
**current_allocated_cpu** | **i32** |  | 
**current_allocated_disk_gib** | **i32** |  | 
**current_allocated_memory_gib** | **i32** |  | 
**current_cpu_usage_percentage** | **f32** |  | 
**current_disk_usage_percentage** | **f32** |  | 
**current_image_count** | **i32** |  | 
**current_memory_usage_percentage** | **f32** |  | 
**disk** | **i32** |  | 
**domain** | **String** |  | 
**gpu** | **i32** |  | 
**gpu_type** | **String** |  | 
**id** | [**uuid::Uuid**](uuid::Uuid.md) |  | 
**last_checked** | Option<**String**> |  | [optional]
**memory** | **i32** |  | 
**proxy_url** | **String** |  | 
**region** | **String** |  | 
**state** | [**models::ExecutorState**](ExecutorState.md) |  | 
**unschedulable** | **bool** |  | 
**updated_at** | **String** |  | 
**used** | **i32** |  | 
**version** | **String** |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


