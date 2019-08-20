### Application Deployment Process

Pre-requisites:
 - ARN of any existing DynomoDB table
 - Name of existing S3 bucket

1. `git clone git@github.com:igeiman/naildesigns.git && cd naildesigns`
2. `git checkout [branch name]]`
3. `amplify init` (specify that you want to create a new environment and give a name of the environment)
4. update sharp module - please see issue with nodejs Lambda using sharp module below:
```
	http://sharp.pixelplumbing.com/en/stable/install/#aws-lambda
	rm -rf node_modules/sharp
	 docker run -v "$PWD":/var/task lambci/lambda:build-nodejs8.10 npm install sharp
```
5. update amplify/backend/function/S3Trigger9762a3ea/parameters.json with valid values (they will be replaced with the real values later on); update amplify/backend/sns/parameters.json with email address of the "site moderator". Notifications of attempts to upload unsuitable content are sent will be sent to this email
6. `amplify push`
7. update amplify/backend/function/S3Trigger9762a3ea/parameters.json with the actual values of DynamoDB table ARN and S3 bucket name. Might need to perform step 4 again and remove sharp module and package-lock.json from the amplify/backend/function/S3Trigger9762a3ea/src:
- `cd amplify/backend/function/S3Trigger9762a3ea/src/`
- `rm -rf node_modules/sharp`
- `rm -rf package-lock.json`
- `docker run -v "$PWD":/var/task lambci/lambda:build-nodejs8.10 npm install sharp`
8. `amplify push`
9. Confirm subscription to recieve moderation emails
10. `npm install`
9. `amplify serve`   application is served on localhost:3000
10. `amplify hosting add` to add static hosting in S3
11. `amplify publish` application is served from CloudFront distribution fronting static web site on S3
12. `amplify env remove [env name]`, delete the environment or
13. `amplify delete` to delete all the environments
11. Modify access policy of Elastic Search cluster and define desired access level. The deployment grants access to Lambda function only

Optional - Sentiment Analisys for Comments
Since Amplify has a very opitionated way of deploying api component, i did not find a way to override the function that streams from DynamoDB to ES

To add comprehend to the application:
Add Comprehend permissions to already deployed DdbToEsFn:
                "comprehend:DetectDominantLanguage",
                "comprehend:DetectSentiment"

Override functions code with the code in amplify/backend/python/python_streaming_function.py
Working to find a way to deploy it properly.
Sentiment analisys can be performed on comments in the following langiages: [de, pt, en, it, fr, es]
Please note this code will be overriden on any api change.

## With the change below, there is now a way to implement a custom Lambda for Comment table:
https://github.com/aws-amplify/amplify-cli/issues/987
- remove searchable directive from Comment table
- add another fuction via amplify cli
- modify CF of the function and the code, trigger it only upon changes in Comment table, reference Comment table name and table stream ARN via exports from api CFN.
