// // snippet-start:[sqs.JavaScript.queues.createQueueV3]
// // Import required AWS SDK clients and commands for Node.js
// import { CreateQueueCommand, GetQueueAttributesCommand, GetQueueUrlCommand, 
//     SetQueueAttributesCommand, DeleteQueueCommand, ReceiveMessageCommand, DeleteMessageCommand } from  "@aws-sdk/client-sqs";
//   import {CreateTopicCommand, SubscribeCommand, DeleteTopicCommand } from "@aws-sdk/client-sns";
//   import  { SQSClient } from "@aws-sdk/client-sqs";
//   import  { SNSClient } from "@aws-sdk/client-sns";
//   import  { TextractClient, StartDocumentTextDetectionCommand, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand, GetDocumentTextDetectionCommand, DocumentMetadata } from "@aws-sdk/client-textract";
//   import { stdout } from "process";
//   import {fromIni} from '@aws-sdk/credential-providers';
  
//   // Set the AWS Region.
//   const REGION = "region-name"; //e.g. "us-east-1"
//   const profileName = "profile-name";
//   // Create SNS service object.
//   const textractClient = new TextractClient({region: REGION, 
//     credentials: fromIni({profile: profileName,}), 
//   });
//   const sqsClient = new SQSClient({region: REGION, 
//     credentials: fromIni({profile: profileName,}), 
//   });
//   const snsClient = new SNSClient({region: REGION, 
//     credentials: fromIni({profile: profileName,}), 
//   });
  
//   // Set bucket and video variables
//   const bucket = "bucket-name";                                                                                                                  
//   const documentName = "document-name";
//   const roleArn = "role-arn"
//   const processType = "DETECTION"
//   var startJobId = ""
  
//   var ts = Date.now();
//   const snsTopicName = "AmazonTextractExample" + ts;
//   const snsTopicParams = {Name: snsTopicName}
//   const sqsQueueName = "AmazonTextractQueue-" + ts;
  
//   // Set the parameters
//   const sqsParams = {
//     QueueName: sqsQueueName, //SQS_QUEUE_URL
//     Attributes: {
//       DelaySeconds: "60", // Number of seconds delay.
//       MessageRetentionPeriod: "86400", // Number of seconds delay.
//     },
//   };
  
//   // Process a document based on operation type
//   const processDocumment = async (type, bucket, videoName, roleArn, sqsQueueUrl, snsTopicArn) =>
//   {
//   try
//   {
//       // Set job found and success status to false initially
//     var jobFound = false
//     var succeeded = false
//     var dotLine = 0
//     var processType = type
//     var validType = false
  
//     if (processType == "DETECTION"){
//       var response = await textractClient.send(new StartDocumentTextDetectionCommand({DocumentLocation:{S3Object:{Bucket:bucket, Name:videoName}}, 
//         NotificationChannel:{RoleArn: roleArn, SNSTopicArn: snsTopicArn}}))
//       console.log("Processing type: Detection")
//       validType = true
//     }
  
//     if (processType == "ANALYSIS"){
//       var response = await textractClient.send(new StartDocumentAnalysisCommand({DocumentLocation:{S3Object:{Bucket:bucket, Name:videoName}}, 
//         NotificationChannel:{RoleArn: roleArn, SNSTopicArn: snsTopicArn}}))
//       console.log("Processing type: Analysis")
//       validType = true
//     }
  
//     if (validType == false){
//         console.log("Invalid processing type. Choose Detection or Analysis.")
//         return
//     }
//   // while not found, continue to poll for response
//   console.log(`Start Job ID: ${response.JobId}`)
//   while (jobFound == false){
//     var sqsReceivedResponse = await sqsClient.send(new ReceiveMessageCommand({QueueUrl:sqsQueueUrl, 
//       MaxNumberOfMessages:'ALL', MaxNumberOfMessages:10}));
//     if (sqsReceivedResponse){
//       var responseString = JSON.stringify(sqsReceivedResponse)
//       if (!responseString.includes('Body')){
//         if (dotLine < 40) {
//           console.log('.')
//           dotLine = dotLine + 1
//         }else {
//           console.log('')
//           dotLine = 0 
//         };
//         stdout.write('', () => {
//           console.log('');
//         });
//         await new Promise(resolve => setTimeout(resolve, 5000));
//         continue
//       }
//     }
  
//       // Once job found, log Job ID and return true if status is succeeded
//       for (var message of sqsReceivedResponse.Messages){
//           console.log("Retrieved messages:")
//           var notification = JSON.parse(message.Body)
//           var rekMessage = JSON.parse(notification.Message)
//           var messageJobId = rekMessage.JobId
//           if (String(rekMessage.JobId).includes(String(startJobId))){
//               console.log('Matching job found:')
//               console.log(rekMessage.JobId)
//               jobFound = true
//               // GET RESUlTS FUNCTION HERE
//               var operationResults = await GetResults(processType, rekMessage.JobId)
//               //GET RESULTS FUMCTION HERE
//               console.log(rekMessage.Status)
//           if (String(rekMessage.Status).includes(String("SUCCEEDED"))){
//               succeeded = true
//               console.log("Job processing succeeded.")
//               var sqsDeleteMessage = await sqsClient.send(new DeleteMessageCommand({QueueUrl:sqsQueueUrl, ReceiptHandle:message.ReceiptHandle}));
//           }
//           }else{
//           console.log("Provided Job ID did not match returned ID.")
//           var sqsDeleteMessage = await sqsClient.send(new DeleteMessageCommand({QueueUrl:sqsQueueUrl, ReceiptHandle:message.ReceiptHandle}));
//           }
//       }
  
//   console.log("Done!")
//   }
//   }catch (err) {
//       console.log("Error", err);
//     }
//   }
  
//   // Create the SNS topic and SQS Queue
//   const createTopicandQueue = async () => {
//   try {
//     // Create SNS topic
//     const topicResponse = await snsClient.send(new CreateTopicCommand(snsTopicParams));
//     const topicArn = topicResponse.TopicArn
//     console.log("Success", topicResponse);
//     // Create SQS Queue
//     const sqsResponse = await sqsClient.send(new CreateQueueCommand(sqsParams));
//     console.log("Success", sqsResponse);
//     const sqsQueueCommand = await sqsClient.send(new GetQueueUrlCommand({QueueName: sqsQueueName}))
//     const sqsQueueUrl = sqsQueueCommand.QueueUrl
//     const attribsResponse = await sqsClient.send(new GetQueueAttributesCommand({QueueUrl: sqsQueueUrl, AttributeNames: ['QueueArn']}))
//     const attribs = attribsResponse.Attributes
//     console.log(attribs)
//     const queueArn = attribs.QueueArn
//     // subscribe SQS queue to SNS topic
//     const subscribed = await snsClient.send(new SubscribeCommand({TopicArn: topicArn, Protocol:'sqs', Endpoint: queueArn}))
//     const policy = {
//       Version: "2012-10-17",
//       Statement: [
//         {
//           Sid: "MyPolicy",
//           Effect: "Allow",
//           Principal: {AWS: "*"},
//           Action: "SQS:SendMessage",
//           Resource: queueArn,
//           Condition: {
//             ArnEquals: {
//               'aws:SourceArn': topicArn
//             }
//           }
//         }
//       ]
//     };
  
//     const response = sqsClient.send(new SetQueueAttributesCommand({QueueUrl: sqsQueueUrl, Attributes: {Policy: JSON.stringify(policy)}}))
//     console.log(response)
//     console.log(sqsQueueUrl, topicArn)
//     return [sqsQueueUrl, topicArn]
  
//   } catch (err) {
//     console.log("Error", err);
  
//   }
//   }
  
//   const deleteTopicAndQueue = async (sqsQueueUrlArg, snsTopicArnArg) => {
//   const deleteQueue = await sqsClient.send(new DeleteQueueCommand({QueueUrl: sqsQueueUrlArg}));
//   const deleteTopic = await snsClient.send(new DeleteTopicCommand({TopicArn: snsTopicArnArg}));
//   console.log("Successfully deleted.")
//   }
  
//   const displayBlockInfo = async (block) => {
//   console.log(`Block ID: ${block.Id}`)
//   console.log(`Block Type: ${block.BlockType}`)
//   if (String(block).includes(String("EntityTypes"))){
//       console.log(`EntityTypes: ${block.EntityTypes}`)
//   }
//   if (String(block).includes(String("Text"))){
//       console.log(`EntityTypes: ${block.Text}`)
//   }
//   if (!String(block.BlockType).includes('PAGE')){
//       console.log(`Confidence: ${block.Confidence}`)
//   }
//   console.log(`Page: ${block.Page}`)
//   if (String(block.BlockType).includes("CELL")){
//       console.log("Cell Information")
//       console.log(`Column: ${block.ColumnIndex}`)
//       console.log(`Row: ${block.RowIndex}`)
//       console.log(`Column Span: ${block.ColumnSpan}`)
//       console.log(`Row Span: ${block.RowSpan}`)
//       if (String(block).includes("Relationships")){
//           console.log(`Relationships: ${block.Relationships}`)
//       }
//   }
  
//   console.log("Geometry")
//   console.log(`Bounding Box: ${JSON.stringify(block.Geometry.BoundingBox)}`)
//   console.log(`Polygon: ${JSON.stringify(block.Geometry.Polygon)}`)
  
//   if (String(block.BlockType).includes('SELECTION_ELEMENT')){
//     console.log('Selection Element detected:')
//     if (String(block.SelectionStatus).includes('SELECTED')){
//       console.log('Selected')
//     } else {
//       console.log('Not Selected')
//     }
  
//   }
//   }
  
//   const GetResults = async (processType, JobID) => {
  
//   var maxResults = 1000
//   var paginationToken = null
//   var finished = false
  
//   while (finished == false){
//     var response = null
//     if (processType == 'ANALYSIS'){
//       if (paginationToken == null){
//         response = textractClient.send(new GetDocumentAnalysisCommand({JobId:JobID, MaxResults:maxResults}))
    
//       }else{
//         response = textractClient.send(new GetDocumentAnalysisCommand({JobId:JobID, MaxResults:maxResults, NextToken:paginationToken}))
//       }
//     }
      
//     if(processType == 'DETECTION'){
//       if (paginationToken == null){
//         response = textractClient.send(new GetDocumentTextDetectionCommand({JobId:JobID, MaxResults:maxResults}))
    
//       }else{
//         response = textractClient.send(new GetDocumentTextDetectionCommand({JobId:JobID, MaxResults:maxResults, NextToken:paginationToken}))
//       }
//     }
  
//     await new Promise(resolve => setTimeout(resolve, 5000));
//     console.log("Detected Documented Text")
//     console.log(response)
//     //console.log(Object.keys(response))
//     console.log(typeof(response))
//     var blocks = (await response).Blocks
//     console.log(blocks)
//     console.log(typeof(blocks))
//     var docMetadata = (await response).DocumentMetadata
//     var blockString = JSON.stringify(blocks)
//     var parsed = JSON.parse(JSON.stringify(blocks))
//     console.log(Object.keys(blocks))
//     console.log(`Pages: ${docMetadata.Pages}`)
//     blocks.forEach((block)=> {
//       displayBlockInfo(block)
//       console.log()
//       console.log()
//     })
  
//     //console.log(blocks[0].BlockType)
//     //console.log(blocks[1].BlockType)
  
  
//     if(String(response).includes("NextToken")){
//       paginationToken = response.NextToken
//     }else{
//       finished = true
//     }
//   }
  
//   }
  
  
//   // DELETE TOPIC AND QUEUE
//   const main = async () => {
//   var sqsAndTopic = await createTopicandQueue();
//   var process = await processDocumment(processType, bucket, documentName, roleArn, sqsAndTopic[0], sqsAndTopic[1])
//   var deleteResults = await deleteTopicAndQueue(sqsAndTopic[0], sqsAndTopic[1])
//   }
  
//   main()