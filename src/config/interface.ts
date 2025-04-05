import { SentimentScore, SentimentType } from "aws-sdk/clients/comprehend";

interface IEntity {
  text: string | null;
  type: string | null;
  score: string | null;
}

interface ISentiment {
  score: SentimentScore;
  sentiment: SentimentType;
}

export interface IAnalysisResponse {
  sentiment: ISentiment;
  entities: IEntity[];
}
