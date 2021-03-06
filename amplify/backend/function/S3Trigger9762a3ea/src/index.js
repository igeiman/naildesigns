// photo-albums/amplify/backend/function/workshopphotoprocessor/src/index.js

const AWS = require('aws-sdk');
const S3 = new AWS.S3({ signatureVersion: 'v4' });
const Rekognition = new AWS.Rekognition();
const SNS = new AWS.SNS({apiVersion: '2010-03-31'})
const DynamoDBDocClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
const uuidv4 = require('uuid/v4');

/*
Note: Sharp requires native extensions to be installed in a way that is compatible
with Amazon Linux (in order to run successfully in a Lambda execution environment).

If you're not working in Cloud9, you can use a docker image
built to mimic AWS Lamda's execution environment to install the module's native dependencies:
docker run -v "$PWD":/var/task lambci/lambda:build-nodejs8.10 npm install
*/
const Sharp = require('sharp');

/*
To allow real time updates with subscription upon photo upload we need
add Photos to DynamoDB via AppSync endpoint called from Lambda function
https://aws.amazon.com/blogs/mobile/supporting-backend-and-internal-processes-with-aws-appsync-multiple-authorization-types/
*/
const AUTH_TYPE = require('aws-appsync/lib/link/auth-link').AUTH_TYPE;
const AWSAppSyncClient = require('aws-appsync').default;
const gql = require('graphql-tag');
require('isomorphic-fetch');


const createPhotoMutation =
`mutation createPhoto($input: CreatePhotoInput!) {
	createPhoto(input: $input) {
	photoAlbumId
    id
  }
}`;

const config = {
  url: process.env.APPSYNC_ENDPOINT,
  region: process.env.AWS_REGION,
  auth: {
    type: AUTH_TYPE.AWS_IAM,
    credentials: AWS.config.credentials,
  },
  disableOffline: true
};

const client = new AWSAppSyncClient(config);

// We'll expect these environment variables to be defined when the Lambda function is deployed
const THUMBNAIL_WIDTH = parseInt(process.env.THUMBNAIL_WIDTH, 10);
const THUMBNAIL_HEIGHT = parseInt(process.env.THUMBNAIL_HEIGHT, 10);
const DYNAMODB_PHOTOS_TABLE_NAME = process.env.DYNAMODB_PHOTOS_TABLE_ARN.split('/')[1];
const TOPIC_ARN = process.env.SNS_TOPIC;

async function getLabelNames(bucketName, key) {
  let params = {
    Image: {
      S3Object: {
        Bucket: bucketName,
        Name: key
      }
    },
    MaxLabels: 50,
    MinConfidence: 70
  };

  const detectionResult = await Rekognition.detectLabels(params).promise();
  const labelNames = detectionResult.Labels.map((l) => l.Name.toLowerCase());
  return labelNames;
}

async function detectExplicitConetnt(bucketName, key) {
let detectParams = {
	Image: {
		S3Object: {
		Bucket: bucketName,
		Name: key
		}
	},
	MinConfidence: 70
	};
	const explicitContent = await Rekognition.detectModerationLabels(detectParams).promise();
	console.log("Explicit content call processed: " + JSON.stringify(explicitContent));
	if (explicitContent.ModerationLabels.length) {
		console.log("Explicit content detected ", explicitContent.ModerationLabels.map((l) => l.Name.toLowerCase()));
		return true;
	}
	else {
		return false;
	}
}

function storePhotoInfo(item) {
    const params = {
        Item: item,
        TableName: DYNAMODB_PHOTOS_TABLE_NAME
    };
    return DynamoDBDocClient.put(params).promise();
}

async function sendPhotoToAppSync(item){
	try {
		console.log("About to send data to graphQL")
		console.log("Sending data ", item)
		const result = await client.mutate({
		  mutation: gql(createPhotoMutation),
		  variables: {input: item}
		});
		console.log("Result from the AppSync mutation: ", result.data);
		callback(null, result.data);
	  } catch (e) {
		console.warn('Error sending mutation: ',  e);
		callback(Error(e));
	  }
}

async function getMetadata(bucketName, key) {
    const headResult = await S3.headObject({Bucket: bucketName, Key: key }).promise();
    return headResult.Metadata;
}

function thumbnailKey(filename) {
    return `public/resized/${filename}`;
}

function fullsizeKey(filename) {
    return `public/${filename}`;
}

function makeThumbnail(photo) {
    return Sharp(photo).resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT).toBuffer();
}

async function resize(bucketName, key) {
    const originalPhoto = (await S3.getObject({ Bucket: bucketName, Key: key }).promise()).Body;
    const originalPhotoName = key.replace('uploads/', '');
    const originalPhotoDimensions = await Sharp(originalPhoto).metadata();

    const thumbnail = await makeThumbnail(originalPhoto);

    await Promise.all([
        S3.putObject({
            Body: thumbnail,
            Bucket: bucketName,
            Key: thumbnailKey(originalPhotoName),
        }).promise(),

        S3.copyObject({
            Bucket: bucketName,
            CopySource: bucketName + '/' + key,
            Key: fullsizeKey(originalPhotoName),
        }).promise(),
    ]);

    await S3.deleteObject({
        Bucket: bucketName,
        Key: key
    }).promise();

    return {
        photoId: originalPhotoName,

        thumbnail: {
            key: thumbnailKey(originalPhotoName),
            width: THUMBNAIL_WIDTH,
            height: THUMBNAIL_HEIGHT
        },

        fullsize: {
            key: fullsizeKey(originalPhotoName),
            width: originalPhotoDimensions.width,
            height: originalPhotoDimensions.height
        }
    };
};

async function sendEmail(metadata) {

// Create publish parameters
  var params = {
	Message: `The owner of album ${metadata.albumid} attempted moderated content upload. `, /* required */
	TopicArn: TOPIC_ARN
  };

  // Create promise and SNS service object
  var publishTextPromise = SNS.publish(params).promise();

  // Handle promise's fulfilled/rejected states
  publishTextPromise.then(
	function(data) {
	  console.log("Message", params.Message, "send sent to the topic", params.TopicArn);
	  console.log("MessageID is " + data.MessageId);
	}).catch(
	  function(err) {
	  console.error(err, err.stack);
	});

}

async function processRecord(record) {
    const bucketName = record.s3.bucket.name;
    const key = record.s3.object.key;

    if (key.indexOf('uploads') != 0) return;
    const metadata = await getMetadata(bucketName, key);
	const sizes = await resize(bucketName, key);
	const explicitContent = await detectExplicitConetnt(bucketName, sizes.fullsize.key);

	// We will not store or process explicit content so it will never show in the albums
	if (explicitContent) {
		console.log("Moderated image - not processing!")
		// send emails via ses
		await sendEmail(metadata);
		return;
	}

    const labelNames = await getLabelNames(bucketName, sizes.fullsize.key);

	if (! labelNames.includes("manicure") && !labelNames.includes("nail") ) {
		console.log("Image does not contain nail designs! Exiting...")
		// send emails via sns
		return;
	}

	const id = uuidv4();
    const item = {
        id: id,
        owner: metadata.owner,
        labels: labelNames,
        photoAlbumId: metadata.albumid,
        bucket: bucketName,
        thumbnail: sizes.thumbnail,
        fullsize: sizes.fullsize,
        createdAt: new Date().getTime()
    }
	// await storePhotoInfo(item);
	// send Create photo request to AppSync endpoint
	await sendPhotoToAppSync(item);
}

exports.handler = async (event, context, callback) => {
    try {
        event.Records.forEach(processRecord);
        callback(null, { status: 'Photo Processed' });
    }
    catch (err) {
        console.error(err);
        callback(err);
    }
};
