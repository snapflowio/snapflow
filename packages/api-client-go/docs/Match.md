# Match

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**File** | **string** |  | 
**Line** | **float32** |  | 
**Content** | **string** |  | 

## Methods

### NewMatch

`func NewMatch(file string, line float32, content string, ) *Match`

NewMatch instantiates a new Match object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewMatchWithDefaults

`func NewMatchWithDefaults() *Match`

NewMatchWithDefaults instantiates a new Match object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetFile

`func (o *Match) GetFile() string`

GetFile returns the File field if non-nil, zero value otherwise.

### GetFileOk

`func (o *Match) GetFileOk() (*string, bool)`

GetFileOk returns a tuple with the File field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFile

`func (o *Match) SetFile(v string)`

SetFile sets File field to given value.


### GetLine

`func (o *Match) GetLine() float32`

GetLine returns the Line field if non-nil, zero value otherwise.

### GetLineOk

`func (o *Match) GetLineOk() (*float32, bool)`

GetLineOk returns a tuple with the Line field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLine

`func (o *Match) SetLine(v float32)`

SetLine sets Line field to given value.


### GetContent

`func (o *Match) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *Match) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *Match) SetContent(v string)`

SetContent sets Content field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


