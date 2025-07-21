# CreateBuildInfo

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**DockerfileContent** | **string** | The Dockerfile content used for the build | 
**ContextHashes** | Pointer to **[]string** | The context hashes used for the build | [optional] 

## Methods

### NewCreateBuildInfo

`func NewCreateBuildInfo(dockerfileContent string, ) *CreateBuildInfo`

NewCreateBuildInfo instantiates a new CreateBuildInfo object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateBuildInfoWithDefaults

`func NewCreateBuildInfoWithDefaults() *CreateBuildInfo`

NewCreateBuildInfoWithDefaults instantiates a new CreateBuildInfo object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetDockerfileContent

`func (o *CreateBuildInfo) GetDockerfileContent() string`

GetDockerfileContent returns the DockerfileContent field if non-nil, zero value otherwise.

### GetDockerfileContentOk

`func (o *CreateBuildInfo) GetDockerfileContentOk() (*string, bool)`

GetDockerfileContentOk returns a tuple with the DockerfileContent field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDockerfileContent

`func (o *CreateBuildInfo) SetDockerfileContent(v string)`

SetDockerfileContent sets DockerfileContent field to given value.


### GetContextHashes

`func (o *CreateBuildInfo) GetContextHashes() []string`

GetContextHashes returns the ContextHashes field if non-nil, zero value otherwise.

### GetContextHashesOk

`func (o *CreateBuildInfo) GetContextHashesOk() (*[]string, bool)`

GetContextHashesOk returns a tuple with the ContextHashes field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContextHashes

`func (o *CreateBuildInfo) SetContextHashes(v []string)`

SetContextHashes sets ContextHashes field to given value.

### HasContextHashes

`func (o *CreateBuildInfo) HasContextHashes() bool`

HasContextHashes returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


