# Getting User Attributes

Article Scope

This article applies to 👤 User SSO Tokens capability only.  
This article applies to 🛡 Shielded applications.  

You can find the same info for [Unshielded Applications](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/unshielded-apps/getting-user-attributes)

For **Shielded applications**, AuthBlue supports three methods of getting the current user's attributes in applications. Please choose the method which works best for you.

|Method|AuthBlue Support|Notes|
|---|---|---|
|[Request Headers](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/getting-user-attributes#request-headers)|🛡 Shielded|This method comes "out of the box" for Shielded applications, very little integration is needed. Only a pre-determined set of user attributes are available.|
|[JWT Token](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/getting-user-attributes#jwt-token)|🛡 Shielded🗡 Unshielded|This method comes "out of the box", very little integration is needed. Only a pre-determined set of user attributes are available.|
|[User Info API](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/getting-user-attributes#user-info-api)|🛡 Shielded🗡 Unshielded|This method will require additional integration with your application, involving making an API call. This method allows you to fetch attributes within Active Directory for the user. This is the only method which provides entitlement (group membership) information for the user.|
|![](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)|![](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)|![](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)|

## Request Headers

When the AuthBlue Reverse Proxy protects your application and the request is valid, the reverse proxy will inject user attributes into the request headers. Your application (on server-side code only) will be able to read these request headers.

JavaScript Applications

Because AuthBlue SSO is an infrastructure-based solution, applications built on certain JavaScript technology stacks (One App or ReactJS) will require additional client-side logic to enforce an application's SSO policy.

[More Info](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/using-javascript-applications)

Important Notes about request headers

- You will _**not**_ see these injected request headers in the browser's Developer Tools The AuthBlue Reverse Proxy injects the headers after the browser has sent the request.
    
- Request headers are only injected on **projected routes**. If you policy specifies a route as unprotected, then the headers will not be injected.
    
- Additionally, these request headers will only be available when your application has been deployed to E1, E2 or E3. These headers will not be available to your application while developing on local workstation.
    

### Available Attributes

Below are the headers injected into every HTTP request send to your application.

|Field|Description|
|---|---|
|adsId|Active Directory ID of the user|
|email|The user's email address|
|employeeid|The user's employee or contractor number|
|firstname|The user's first name|
|fullname|The user's full name, usually first name, middle initial and last name|
|GUID|The user's unique identifier1|
|lastname|The user's last name|

- 1 Please note, this field is not populated for service accounts by default. You can ask the Active Directory team to populate this field upon request, reach out in [#ads-infoshare Slack channel](https://my.slack.com/archives/C8VLGKEAV)
    

You can also see them on [our sample application](https://absddc2testapp2.aexp.com/). The page lists all headers, not just those provided by AuthBlue.

### Code Examples

- Java (Spring Controller)
- Java (JSP)
- JavaScript (Browser)
- JavaScript (NodeJS)

```
const express = require('express');const port = 3000;const app = express();/* This function will read the firstname request header, and send it back to the browser */function getFirstName(req, res) {  const firstName = req.headers['firstname'];  res.status(200).send({    firstName,  });}/* This function will read the firstname and employeeid request headers, and send them back to the browser */function getMoreInfo(req, res) {  const firstName = req.headers['firstname'];  const employeeId = req.headers['employeeid'];  res.status(200).send({    firstName,    employeeId,  });}app.get('/get/first/name', getFirstName);app.get('/get/more/info', getMoreInfo);app.listen(port, () => {  console.log(`App listening at http://localhost:${port}`);});
```

## JWT Token

AuthBlue creates a [JSON Web Token (JWT)](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/jwt-token-details) which represents a user's session. This session is stored as an [HTTP cookie named `bluetoken`](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/session-details) in the browser.

JWT tokens can be easily decoded to inspect and access claims within the token. Application Owners can use any industry standard JWT library available for your technology stack.

JavaScript Applications

Because AuthBlue SSO is an infrastructure-based solution, applications built on certain JavaScript technology stacks (One App or ReactJS) will require additional client-side logic to enforce an applications SSO policy.

[More Info](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/using-javascript-applications)

Decoding JWT Tokens

**Please understand the distinction between _decoding_ and _validating_ a JWT token.**

Decoding a JWT (JSON Web Token) involves extracting the header and payload, which contain information like claims and algorithm, without verifying the signature of the token.

Validation, on the other hand, verifies the signature to ensure the token's authenticity and integrity, and also checks claims like expiration and issuer.

[More Info](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/jwt-token-details#decoding-vs-validating)

Below are the contents of the JWT stored in a bluetoken cookie. You will have access to this when executed on server side code, the cookie is HTTP-Only, meaning it is not accessible from JavaScript in the browser. If you are using client-side code, such as an SPA application written in JavaScript (ReactJS, Angular or VueJS), then you may need to add an API endpoint using the example code below.

### The AuthBlue Token (`bluetoken` cookie)

bluetoken cookie

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtc2ciOiJyZXNjYW5uaWcgaXMgYXV0b21hdGljIiwiaWF0IjoxNTE2MjM5MDIyfQ.wv2emR73EnK6-0mhinbuYSoUMsYMe3OKDJrAJolyeJ0
```

### Decoding the JWT token

Decoding JWT Tokens

**Using externally hosted JWT decoding tools creates a security risk for American Express.**

Please make sure to use the [internal JWT tool](https://mobiletools.aexp.com/jwt) for debugging tokens.

User SSO JWT Token Header

```
{  "alg": "RS256"}
```

User SSO JWT Token Payload

```
{  // user specific fields  "GUID": "252e050f9cc84f5c966b23e62b9c5a80",  "employeeid": "123456",  "firstname": "John",  "lastname": "Doe",  "fullname": "Johnn Doe",  "email": "john.a.doe1@aexp.com",  "udn": "CN=John Doe user,OU=FIMPortal,OU=AMEX,DC=ADS-SSO-1,DC=AEXP,DC=COM"  // JWT standard fields  "sub": "8156970",  "amr": [    "pwd"  ],  "iss": "https://aexp.com",  "aud": "*-dev.aexp.com",  "uid": "authblueuser1200user",  "exp": 1564446306,  "iat": 1564442706,  "jti": "95c5a5ec-5d5a-499d-8275-ffc19c506a49",}
```

### Code Examples

Example using Node.js and ExpressJS

Example middleware code to serve JWT contents to client application.

[https://github.aexp.com/amex-eng/authblue-self-service-api/blob/main/app/middleware/addAuthBlueUserToRequest.js](https://github.aexp.com/amex-eng/authblue-self-service-api/blob/main/app/middleware/addAuthBlueUserToRequest.js)

## User Info API

The AuthBlue User Info API allows you to get user details for the currently logged on user. The API Endpoint uses the token in available in the browser, and returns the user's info the calling information.

JavaScript Applications

Because AuthBlue SSO is an infrastructure based solution, applications built on certain JavaScript technology stacks (One App or ReactJS) will require additional client-side logic to enforce an applications SSO policy.

[More Info](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/using-javascript-applications)

### API Reference

The User Info endpoints are a subset of the User SSO Token API endpoints.

- [Tokens API - User SSO Tokens - Reference](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/components/token-api/#tag/User-SSO-Tokens)
- [Swagger UI](https://authbluetokens-dev.aexp.com/v1/swagger-ui/index.html)

info

These API endpoints Are for AuthBlue User SSO Tokens. They will not work for [AuthBlue App2App Tokens](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/app2app-tokens/getting-user-attributes).

#### Authentication

For these endpoints, the only authentication that is needed is the user's `bluetoken` cookie.

#### GET `/v1/user/userinfo`

[Swagger](https://authbluetokens-dev.aexp.com/v1/swagger-ui/index.html#/User%20SSO%20Tokens/getUserUserInfo)

Provides a **pre-defined subset of attributes** (most commonly used) for the current user.

info

This endpoint does not take any parameters, and will only return a pre-defined subset of attributes. Additionally, it does not fetch group membership for the user. Please use the [POST endpoint](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/getting-user-attributes#post-user-info) to retrieve group memberships.

API Request

```
GET https://authbluetokens-dev.aexp.com/v1/user/userinfoCookie: bluetoken=XXXXXXXXXXXXXXXXXXXXXXX
```

GET API Response

```
{  "uid": "cfrost",  "firstname": "Charles",  "scope": {},  "GUID": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",  "fullname": "Charles Frost",  "message": "success",  "employeeid": "8881234",  "email": "charles.frost@aexp.com",  "udn": "CN=Charles Frost,OU=FIMPortal,OU=AMEX,DC=ADS-SSO-1,DC=AEXP,DC=COM",  "lastname": "Frost",  "status": "success"}
```

#### POST `/v1/user/userinfo`

[Swagger](https://authbluetokens-dev.aexp.com/v1/swagger-ui/index.html#/User%20SSO%20Tokens/userInfoForUserToken)

When calling the userinfo endpoint, the scope details which Active Directory / LDAP attributes and groups will be included in the response.

Performance and Caching

It is recommended that you fetch the user details once at the beginning of a session and cache the results within your application for better performance. Please be sure to include all attributes and/or groups that your application may use.

Group Number Limitation

The API has a maximum limit of 50 groups per request. Requests that contain more than 50 groups will need to split into multiple calls. For example, if you have 75 groups that need to be validated, you will need to split your request into 2 API calls.

Similarly, if you have a total of 200 groups that require validation, you will need to split the request into 4 separate calls.

Scope The userinfo API endpoints pulls attributes and group data from Active Directory/LDAP

- **Attributes:** Specify an array of LDAP attributes you wish to receive. Please reference our [mapping here for the most commonly used attributes](https://github.aexp.com/pages/amex-eng/authblue-documentation/docs/user-sso-tokens/shielded-apps/getting-user-attributes#active-directory-attributes).
- **Groups:** Specify an array of group names you are checking for, and the response will be the subset of that list which the user is actually a member of. If the groups array is returned as empty, then the user is not a member of the groups specified. At this time, wildcards are not supported.

In the following request, 3 attributes are being requested, along with 3 entitlements (groups). The API will return the attributes, along with the subset of the requested groups which the user is actually a member of.

API Request

```
POST https://authbluetokens-dev.aexp.com/v1/user/userinfoCookie: bluetoken=XXXXXXXXXXXXXXXXXXXXXXXContent-Type: application/json{  "scope": {    "attributes": [      "uid", "fullname", "email"    ],    "groups": [      "SSO_APP_USER"      "SSO_APP_ADMIN"      "SSO_APP_SUPER_ADMIN"    ],  }}
```

POST API Response

```
{  "uid": "cfrost",  "scope": {},  "groups": [ "SSO_APP_ADMIN"],  "fullname": "Charles Frost",  "message": "success",  "email": "charles.frost@aexp.com",  "status": "success"}
```
