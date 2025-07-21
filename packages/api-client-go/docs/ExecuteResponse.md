# ExecuteResponse

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ExitCode** | **float32** | Exit code | 
**Result** | **string** | Command output | 

## Methods

### NewExecuteResponse

`func NewExecuteResponse(exitCode float32, result string, ) *ExecuteResponse`

NewExecuteResponse instantiates a new ExecuteResponse object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewExecuteResponseWithDefaults

`func NewExecuteResponseWithDefaults() *ExecuteResponse`

NewExecuteResponseWithDefaults instantiates a new ExecuteResponse object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetExitCode

`func (o *ExecuteResponse) GetExitCode() float32`

GetExitCode returns the ExitCode field if non-nil, zero value otherwise.

### GetExitCodeOk

`func (o *ExecuteResponse) GetExitCodeOk() (*float32, bool)`

GetExitCodeOk returns a tuple with the ExitCode field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExitCode

`func (o *ExecuteResponse) SetExitCode(v float32)`

SetExitCode sets ExitCode field to given value.


### GetResult

`func (o *ExecuteResponse) GetResult() string`

GetResult returns the Result field if non-nil, zero value otherwise.

### GetResultOk

`func (o *ExecuteResponse) GetResultOk() (*string, bool)`

GetResultOk returns a tuple with the Result field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetResult

`func (o *ExecuteResponse) SetResult(v string)`

SetResult sets Result field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


