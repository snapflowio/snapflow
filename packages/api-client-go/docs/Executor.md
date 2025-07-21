# Executor

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** | The ID of the executor | 
**Domain** | **string** | The domain of the executor | 
**ApiUrl** | **string** | The API URL of the executor | 
**ApiKey** | **string** | The API key for the executor | 
**Cpu** | **float32** | The CPU capacity of the executor | 
**Memory** | **float32** | The memory capacity of the executor in GB | 
**Disk** | **float32** | The disk capacity of the executor in GB | 
**Gpu** | **float32** | The GPU capacity of the executor | 
**GpuType** | **string** | The type of GPU | 
**Class** | [**SandboxClass**](SandboxClass.md) | The class of the executor | 
**Used** | **float32** | The current usage of the executor | 
**Capacity** | **float32** | The capacity of the executor | 
**Region** | [**ExecutorRegion**](ExecutorRegion.md) | The region of the executor | 
**State** | [**ExecutorState**](ExecutorState.md) | The state of the executor | 
**LastChecked** | Pointer to **string** | The last time the executor was checked | [optional] 
**Unschedulable** | **bool** | Whether the executor is unschedulable | 
**CreatedAt** | **string** | The creation timestamp of the executor | 
**UpdatedAt** | **string** | The last update timestamp of the executor | 

## Methods

### NewExecutor

`func NewExecutor(id string, domain string, apiUrl string, apiKey string, cpu float32, memory float32, disk float32, gpu float32, gpuType string, class SandboxClass, used float32, capacity float32, region ExecutorRegion, state ExecutorState, unschedulable bool, createdAt string, updatedAt string, ) *Executor`

NewExecutor instantiates a new Executor object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewExecutorWithDefaults

`func NewExecutorWithDefaults() *Executor`

NewExecutorWithDefaults instantiates a new Executor object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *Executor) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *Executor) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *Executor) SetId(v string)`

SetId sets Id field to given value.


### GetDomain

`func (o *Executor) GetDomain() string`

GetDomain returns the Domain field if non-nil, zero value otherwise.

### GetDomainOk

`func (o *Executor) GetDomainOk() (*string, bool)`

GetDomainOk returns a tuple with the Domain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDomain

`func (o *Executor) SetDomain(v string)`

SetDomain sets Domain field to given value.


### GetApiUrl

`func (o *Executor) GetApiUrl() string`

GetApiUrl returns the ApiUrl field if non-nil, zero value otherwise.

### GetApiUrlOk

`func (o *Executor) GetApiUrlOk() (*string, bool)`

GetApiUrlOk returns a tuple with the ApiUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetApiUrl

`func (o *Executor) SetApiUrl(v string)`

SetApiUrl sets ApiUrl field to given value.


### GetApiKey

`func (o *Executor) GetApiKey() string`

GetApiKey returns the ApiKey field if non-nil, zero value otherwise.

### GetApiKeyOk

`func (o *Executor) GetApiKeyOk() (*string, bool)`

GetApiKeyOk returns a tuple with the ApiKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetApiKey

`func (o *Executor) SetApiKey(v string)`

SetApiKey sets ApiKey field to given value.


### GetCpu

`func (o *Executor) GetCpu() float32`

GetCpu returns the Cpu field if non-nil, zero value otherwise.

### GetCpuOk

`func (o *Executor) GetCpuOk() (*float32, bool)`

GetCpuOk returns a tuple with the Cpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCpu

`func (o *Executor) SetCpu(v float32)`

SetCpu sets Cpu field to given value.


### GetMemory

`func (o *Executor) GetMemory() float32`

GetMemory returns the Memory field if non-nil, zero value otherwise.

### GetMemoryOk

`func (o *Executor) GetMemoryOk() (*float32, bool)`

GetMemoryOk returns a tuple with the Memory field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMemory

`func (o *Executor) SetMemory(v float32)`

SetMemory sets Memory field to given value.


### GetDisk

`func (o *Executor) GetDisk() float32`

GetDisk returns the Disk field if non-nil, zero value otherwise.

### GetDiskOk

`func (o *Executor) GetDiskOk() (*float32, bool)`

GetDiskOk returns a tuple with the Disk field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDisk

`func (o *Executor) SetDisk(v float32)`

SetDisk sets Disk field to given value.


### GetGpu

`func (o *Executor) GetGpu() float32`

GetGpu returns the Gpu field if non-nil, zero value otherwise.

### GetGpuOk

`func (o *Executor) GetGpuOk() (*float32, bool)`

GetGpuOk returns a tuple with the Gpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGpu

`func (o *Executor) SetGpu(v float32)`

SetGpu sets Gpu field to given value.


### GetGpuType

`func (o *Executor) GetGpuType() string`

GetGpuType returns the GpuType field if non-nil, zero value otherwise.

### GetGpuTypeOk

`func (o *Executor) GetGpuTypeOk() (*string, bool)`

GetGpuTypeOk returns a tuple with the GpuType field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGpuType

`func (o *Executor) SetGpuType(v string)`

SetGpuType sets GpuType field to given value.


### GetClass

`func (o *Executor) GetClass() SandboxClass`

GetClass returns the Class field if non-nil, zero value otherwise.

### GetClassOk

`func (o *Executor) GetClassOk() (*SandboxClass, bool)`

GetClassOk returns a tuple with the Class field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetClass

`func (o *Executor) SetClass(v SandboxClass)`

SetClass sets Class field to given value.


### GetUsed

`func (o *Executor) GetUsed() float32`

GetUsed returns the Used field if non-nil, zero value otherwise.

### GetUsedOk

`func (o *Executor) GetUsedOk() (*float32, bool)`

GetUsedOk returns a tuple with the Used field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUsed

`func (o *Executor) SetUsed(v float32)`

SetUsed sets Used field to given value.


### GetCapacity

`func (o *Executor) GetCapacity() float32`

GetCapacity returns the Capacity field if non-nil, zero value otherwise.

### GetCapacityOk

`func (o *Executor) GetCapacityOk() (*float32, bool)`

GetCapacityOk returns a tuple with the Capacity field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCapacity

`func (o *Executor) SetCapacity(v float32)`

SetCapacity sets Capacity field to given value.


### GetRegion

`func (o *Executor) GetRegion() ExecutorRegion`

GetRegion returns the Region field if non-nil, zero value otherwise.

### GetRegionOk

`func (o *Executor) GetRegionOk() (*ExecutorRegion, bool)`

GetRegionOk returns a tuple with the Region field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRegion

`func (o *Executor) SetRegion(v ExecutorRegion)`

SetRegion sets Region field to given value.


### GetState

`func (o *Executor) GetState() ExecutorState`

GetState returns the State field if non-nil, zero value otherwise.

### GetStateOk

`func (o *Executor) GetStateOk() (*ExecutorState, bool)`

GetStateOk returns a tuple with the State field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetState

`func (o *Executor) SetState(v ExecutorState)`

SetState sets State field to given value.


### GetLastChecked

`func (o *Executor) GetLastChecked() string`

GetLastChecked returns the LastChecked field if non-nil, zero value otherwise.

### GetLastCheckedOk

`func (o *Executor) GetLastCheckedOk() (*string, bool)`

GetLastCheckedOk returns a tuple with the LastChecked field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLastChecked

`func (o *Executor) SetLastChecked(v string)`

SetLastChecked sets LastChecked field to given value.

### HasLastChecked

`func (o *Executor) HasLastChecked() bool`

HasLastChecked returns a boolean if a field has been set.

### GetUnschedulable

`func (o *Executor) GetUnschedulable() bool`

GetUnschedulable returns the Unschedulable field if non-nil, zero value otherwise.

### GetUnschedulableOk

`func (o *Executor) GetUnschedulableOk() (*bool, bool)`

GetUnschedulableOk returns a tuple with the Unschedulable field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUnschedulable

`func (o *Executor) SetUnschedulable(v bool)`

SetUnschedulable sets Unschedulable field to given value.


### GetCreatedAt

`func (o *Executor) GetCreatedAt() string`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *Executor) GetCreatedAtOk() (*string, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *Executor) SetCreatedAt(v string)`

SetCreatedAt sets CreatedAt field to given value.


### GetUpdatedAt

`func (o *Executor) GetUpdatedAt() string`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *Executor) GetUpdatedAtOk() (*string, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *Executor) SetUpdatedAt(v string)`

SetUpdatedAt sets UpdatedAt field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


