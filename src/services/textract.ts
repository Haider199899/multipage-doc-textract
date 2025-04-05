import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import {
  Entity,
  SentimentScore,
  SentimentType,
} from "aws-sdk/clients/comprehend";
import { IAnalysisResponse } from "../config/interface";

dotenv.config();

// AWS Config
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const bucketName = process.env.S3_BUCKET as string;

const s3 = new AWS.S3();
const textract = new AWS.Textract();
const comprehend = new AWS.Comprehend();

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

    const response = await textract
      .startDocumentTextDetection({
        DocumentLocation: {
          S3Object: { Bucket: bucketName, Name: documentKey },
        },
      })
      .promise();
    console.log("Processing started, Job ID:", response.JobId);

    if (!response.JobId) throw new Error("Failed to start Textract job");

    const extractedText = await waitForJobCompletion(response.JobId);
    const textAnalysis = await analyzeText(extractedText as string);
    return {
      extractedText : extractedText?.trim(),
      sentiment: textAnalysis?.sentiment,
      entites: textAnalysis?.entities,
    };
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

async function analyzeText(text: string) {
  try {
    const response = {
      sentiment: { sentiment: "", score: {} },
      entities: [],
    } as IAnalysisResponse;
    // Detect Sentiment
    const sentimentResult = await comprehend
      .detectSentiment({
        Text: text,
        LanguageCode: "en",
      })
      .promise();
    response.sentiment.sentiment = sentimentResult.Sentiment as SentimentType;
    response.sentiment.score = sentimentResult.SentimentScore as SentimentScore;
    // Detect Entities (NER)
    const entitiesResult = await comprehend
      .detectEntities({
        Text: text,
        LanguageCode: "en",
      })
      .promise();
    if (entitiesResult.Entities) {
      entitiesResult.Entities.forEach((entity: Entity, index: number) => {
        response.entities[index] = {
          text: entity.Text as string,
          type: entity.Type as string,
          score: entity.Score?.toFixed(2) || ("0.00" as string),
        };
      });
    } else {
      console.warn("No entities detected in the text.");
    }
    return response;
  } catch (err) {
    console.error("Error analyzing text:", err);
  }
}
