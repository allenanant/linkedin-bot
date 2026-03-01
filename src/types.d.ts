declare module "google-trends-api" {
  interface TrendsOptions {
    keyword?: string;
    geo?: string;
    startTime?: Date;
    endTime?: Date;
    hl?: string;
    category?: number;
  }

  function relatedQueries(options: TrendsOptions): Promise<string>;
  function dailyTrends(options: { geo?: string }): Promise<string>;
  function interestOverTime(options: TrendsOptions): Promise<string>;
  function interestByRegion(options: TrendsOptions): Promise<string>;
  function relatedTopics(options: TrendsOptions): Promise<string>;

  export { relatedQueries, dailyTrends, interestOverTime, interestByRegion, relatedTopics };
}

declare module "open" {
  function open(target: string, options?: any): Promise<any>;
  export default open;
}
