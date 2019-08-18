### Application Deployment Process

Pre-requisites:
 - SNS topic with email subscription for moderation messages
 - ARN of any DynomoDB table
 - Name of S3 buucket

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
7. update amplify/backend/function/S3Trigger9762a3ea/parameters.json with the actual values of DynamoDB table ARN and S3 bucket name. Might need to perform step 4 again and remove sharp module and package-lock.json from the amplify/backend/function/S3Trigger9762a3ea/src
8. `amplify push`
9. Confirm subscription to recieve moderation emails
9. `amplify serve`   application is served on localhost:3000
10. `amplify hosting add` to add static hosting in S3
11. `amplify publish` application is served from CloudFront distribution fronting static web site on S3
12. `amplify env remove [env name]`, delete the environment
