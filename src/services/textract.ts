import {
  TextractClient,
  StartDocumentTextDetectionCommand,
} from "@aws-sdk/client-textract";
import { fromIni } from "@aws-sdk/credential-providers";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

// AWS Config
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const profileName = process.env.AWS_PROFILE_NAME || "default";
const region = process.env.AWS_REGION || "us-east-1";
const snsTopicArn = process.env.SNS_TOPIC_ARN as string;
const roleArn = process.env.ROLE_ARN as string;
const bucketName = process.env.S3_BUCKET as string;

const textractClient = new TextractClient({
  region,
  credentials: fromIni({ profile: profileName }),
});

const s3 = new AWS.S3();
const textract = new AWS.Textract();

const uploadToS3 = async (file: Express.Multer.File): Promise<string> => {
  const fileKey = `uploads/${uuidv4()}-${file.originalname}`;
  await s3
    .upload({
      Bucket: bucketName,
      Key: fileKey,
      Body: file.buffer,
    })
    .promise();
  return fileKey;
};

export const processDocument = async (file: Express.Multer.File) => {
  try {
    const documentKey = await uploadToS3(file);
    console.log("Uploaded document to S3:", documentKey);

    const response = await textractClient.send(
      new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: { Bucket: bucketName, Name: documentKey },
        },
        NotificationChannel: { RoleArn: roleArn, SNSTopicArn: snsTopicArn },
      })
    );

    console.log("Processing started, Job ID:", response.JobId);

    if (!response.JobId) throw new Error("Failed to start Textract job");

    const extractedText = await waitForJobCompletion(response.JobId);
    return extractedText;
  } catch (err) {
    console.error("Error processing document:", err);
    throw err;
  }
};

const getExtractedText = async (
  jobId: string
): Promise<{ extractedText: string; status: string }> => {
  const params = {
    JobId: jobId,
  };
  let extractedText: string = "";
  const result = await textract.getDocumentTextDetection(params).promise();
  // Iterate through blocks and accumulate text
  result.Blocks?.forEach((block: any) => {
    if (block.BlockType === "LINE" && block.Text) {
      extractedText += block.Text + " ";
    }
  });
  return { extractedText: extractedText, status: result.JobStatus as string };
};

const waitForJobCompletion = async (
  jobId: string
): Promise<string | undefined> => {
  let jobCompleted = false;

  while (!jobCompleted) {
    try {
      const { extractedText, status } = await getExtractedText(jobId);

      if (status === "SUCCEEDED") {
        jobCompleted = true;
        return extractedText;
      }
    } catch (error) {
      console.error("Error processing SQS message:", error);
    }
  }
};