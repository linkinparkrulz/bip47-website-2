# Paynym.is API



## Notes

A PayNym account is created with nothing more than a valid BIP47 payment code. A unique nymId and token will be created in the database and will associated with the payment code. 

Because no proof of ownership of the payment code has been provided yet it is marked as unclaimed in the database. An unclaimed payment code cannot be modified.



## Public Requests



### `/api/v1/create`

Create a new PayNym entry in the database.



**Request**

```json
POST /api/v1/create
content-type: application/json

{
 "code":"PM8T..."
}

```

| Value | Key                  |
| ----- | -------------------- |
| code  | A valid payment code |



**Response** (201)

```json
{
"claimed": false,
"nymID": "v9pJm...",
"nymName": "snowysea",
"segwit": true,
"token": "IlBNOF...",
}
```

| Code | Meaning                     |
| ---- | --------------------------- |
| 201  | PayNym created successfully |
| 200  | PayNym already exists       |
| 400  | Bad request                 |



------



### `/api/v1/token`

Update the verification token in the database. A token is valid for 24 hours and only for a single authenticated call. The payment code must be in the database or the request will return `404`



**Request**

```json
POST /api/v1/token/
content-type: application/json

{"code":"PM8T..."}
```

| Value | Key                  |
| ----- | -------------------- |
| code  | A valid payment code |



**Response** (200)

```json
{
"token": "DP7S3w..."
}
```

| Code | Meaning                        |
| ---- | ------------------------------ |
| 200  | Token was successfully updated |
| 404  | Payment code was not found     |
| 400  | Bad request                    |



------



### `/api/v1/nym`

Returns all known information about a PayNym account including any other payment codes associated with this Nym.



**Request**

```json
POST /api/v1/nym/
content-type: application/json

{"nym":"PM8T..."}
```

| Value | Key                                      |
| ----- | ---------------------------------------- |
| nym   | A valid payment `code`, `nymID`, or `nymName` |



**Response** (200)

```json
{
  "codes": [
    {
      "claimed": true,
      "segwit": true,
      "code": "PM8T..."
    }
  ], 
  "followers": [
    {
      "nymId": "5iEpU..."
    }
  ], 
  "following": [], 
  "nymID": "wXGgdC...", 
  "nymName": "littlevoice"
}
```

| Code | Meaning                |
| ---- | ---------------------- |
| 200  | Nym found and returned |
| 404  | Nym not found          |
| 400  | Bad request            |





## Authenticated Requests



### Making authenticated requests

1. Set an `auth-token` header containing the `token` 
2. Sign the `token` with the private key of the notification address of the primary payment code 
3. Add the `signature` to the body of the request. 
4. A token can only be used once per authenticated request. A new `token` will be returned in the response of a successful authenticated request





### `/api/v1/claim`

Claim ownership of a payment code added to a newly created PayNym identity.



**Request**

```json
POST /api/v1/claim
content-type: application/json
auth-token: IlBNOFRKWmt...


{"signature":"..."}
```

| Value     | Key                                      |
| --------- | ---------------------------------------- |
| signature | The `token` signed by the BIP47 notification address |



**Response** (200)

```json
{
"claimed" : "PM8T...",
"token" : "IlBNOFRKSmt..."
}
```

| Code | Meaning                           |
| ---- | --------------------------------- |
| 200  | Payment code successfully claimed |
| 400  | Bad request                       |

------



### `/api/v1/follow`

Follow another PayNym account.



**Request**

```json
POST /api/v1/follow/
content-type: application/json
auth-token: IlBNOFRKWmt...

{
"target": "wXGgdC...",
"signature":"..."
}
```

| Key       | Value                                    |
| --------- | ---------------------------------------- |
| target    | The payment code to follow               |
| signature | The `token` signed by the BIP47 notification address |

**Response** (200)

```json
{
"follower": "5iEpU...",
"following": "wXGgdC...",
"token" : "IlBNOFRKSmt..."
}
```

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 200  | Added to followers                       |
| 404  | Payment code not found                   |
| 400  | Bad request                              |
| 401  | Unauthorized token or signature or Unclaimed payment code |

------



### `/api/v1/unfollow`

Unfollow another PayNym account.



**Request**

```json
POST /api/v1/unfollow/
content-type: application/json
auth-token: IlBNOFRKWmt...

{
"target": "wXGgdC...",
"signature":"..."
}
```

| Key       | Value                                    |
| --------- | ---------------------------------------- |
| target    | The payment code to unfollow             |
| signature | The `token` signed by the BIP47 notification address |

**Response** (200)

```json
{
"follower": "5iEpU...",
"unfollowing": "wXGgdC...",
"token" : "IlBNOFRKSmt..."
}
```

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 200  | Unfollowed successfully                  |
| 404  | Payment code not found                   |
| 400  | Bad request                              |
| 401  | Unauthorized token or signature or Unclaimed payment code |

------



### `/api/v1/nym/add`

Add a new payment code to an existing Nym



**Request**

```json
POST /api/v1/nym/add
content-type: application/json
auth-token: IlBNOFRKWmt...

{
  "nym": "wXGgdC...",
  "code":"PM8T...",
  "signature":"..."
}
```

| Key       | Value                                                        |
| --------- | ------------------------------------------------------------ |
| nym       | A valid payment `code`, `nymID`, or `nymName`                |
| code      | A valid payment code                                         |
| signature | The `token` signed by the BIP47 notification address of the primary payment code. |

**Response** (200)

```json
{
"code":"PM8T...",    
"segwit": true,
"token" : "IlBNOFRKSmt..."
}
```

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 200  | Nym updated successfully                                  |
| 404  | Nym not found                                             |
| 400  | Bad request                                               |
| 401  | Unauthorized token or signature or Unclaimed payment code |

