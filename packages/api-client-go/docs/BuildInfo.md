# BuildInfo

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**DockerfileContent** | Pointer to **string** | The Dockerfile content used for the build | [optional] 
**ContextHashes** | Pointer to **[]string** | The context hashes used for the build | [optional] 
**CreatedAt** | **time.Time** | The creation timestamp | 
**UpdatedAt** | **time.Time** | The last update timestamp | 

## Methods

### NewBuildInfo

`func NewBuildInfo(createdAt time.Time, updatedAt time.Time, ) *BuildInfo`

NewBuildInfo instantiates a new BuildInfo object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBuildInfoWithDefaults

`func NewBuildInfoWithDefaults() *BuildInfo`

NewBuildInfoWithDefaults instantiates a new BuildInfo object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetDockerfileContent

`func (o *BuildInfo) GetDockerfileContent() string`

GetDockerfileContent returns the DockerfileContent field if non-nil, zero value otherwise.

### GetDockerfileContentOk

`func (o *BuildInfo) GetDockerfileContentOk() (*string, bool)`

GetDockerfileContentOk returns a tuple with the DockerfileContent field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDockerfileContent

`func (o *BuildInfo) SetDockerfileContent(v string)`

SetDockerfileContent sets DockerfileContent field to given value.

### HasDockerfileContent

`func (o *BuildInfo) HasDockerfileContent() bool`

HasDockerfileContent returns a boolean if a field has been set.

### GetContextHashes

`func (o *BuildInfo) GetContextHashes() []string`

GetContextHashes returns the ContextHashes field if non-nil, zero value otherwise.

### GetContextHashesOk

`func (o *BuildInfo) GetContextHashesOk() (*[]string, bool)`

GetContextHashesOk returns a tuple with the ContextHashes field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContextHashes

`func (o *BuildInfo) SetContextHashes(v []string)`

SetContextHashes sets ContextHashes field to given value.

### HasContextHashes

`func (o *BuildInfo) HasContextHashes() bool`

HasContextHashes returns a boolean if a field has been set.

### GetCreatedAt

`func (o *BuildInfo) GetCreatedAt() time.Time`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *BuildInfo) GetCreatedAtOk() (*time.Time, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *BuildInfo) SetCreatedAt(v time.Time)`

SetCreatedAt sets CreatedAt field to given value.


### GetUpdatedAt

`func (o *BuildInfo) GetUpdatedAt() time.Time`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *BuildInfo) GetUpdatedAtOk() (*time.Time, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *BuildInfo) SetUpdatedAt(v time.Time)`

SetUpdatedAt sets UpdatedAt field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


