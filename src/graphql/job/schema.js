
export const jobTypeDefs = `#graphql
type Job {
    _id: ID!
    campaign: Campaign
    name: String
    description: String
    status: jobStatusEnum
    priority: Int
    schedule: scheduleJob
    jobType: jobTypeEnum
    payload: outboundCallPayload
    result_ref: JSON
    error_ref: JSON
    log: logEntry
    tags: [String]
    createdBy: User
    business: Business
    createdAt: DateTime
    updatedAt: DateTime
}
type logEntry {
    level: String
    message: String
    timestamp: DateTime
    data: JSON
}
enum jobStatusEnum {
    scheduled
    active
    completed
    failed
    canceled
    delayed
    waiting
}
type outboundCallPayload {
    channel: Channel
    agent: Agent
    to: String
    PreContext: String
    expectedDuration: Int
    maxRetries: Int
    callbackUrl: String
    cps: Int
}
    enum jobTypeEnum {
    outboundCall
}
type scheduleJob {
    run_at: DateTime
    type: scheduleTypeEnum
    timezone: String
    backoff: backoff
    cancel_requested: Boolean
}
enum scheduleTypeEnum {
    once
    cron
}
type backoff {
    type: backoffTypeEnum
    delay_ms: Int
    attempts: attempts
}
type attempts {
    max: Int
    made: Int
    reason: String
}
enum backoffTypeEnum {
    fixed
    exponential
}
type Campaign {
    _id: ID!
    name: String
    agent: Agent
    communicationChannels: [Channel]
    receivers: [Receiver]
    schedule: scheduleCampaign
    cps: Int
    createdBy: User
    business: Business
    createdAt: DateTime
    updatedAt: DateTime
}
type scheduleCampaign {
    startAt: DateTime
    endAt: DateTime
    timezone: String
}
type Receiver {
    personalInfo: PersonalInfo
    preferredLanguage: String
    Instructions: String
}
type PersonalInfo {
    name: String
    contactDetails: ContactDetails
    miscInfo: JSON
}
type ContactDetails {
    email: String
    phone: String
    telegramId: String
    whatsappId: String
    instagramId: String
}
input receiverInput {
    personalInfo: PersonalInfoInput
    preferredLanguage: String
    Instructions: String
}
input personalInfoInput {
    name: String
    contactDetails: contactDetailsInput
    miscInfo: JSON
}
input contactDetailsInput {
    email: String
    phone: String
    telegramId: String
    whatsappId: String
    instagramId: String
}
input scheduleCampaignInput {
    startAt: DateTime
    endAt: DateTime
    timezone: String
}
input scheduleJobInput {
    run_at: DateTime
    type: scheduleTypeEnum
}
input backoffInput {
    type: backoffTypeEnum
    delay_ms: Int
    attempts: attemptsInput
}
input attemptsInput {
    max: Int
    made: Int
    reason: String
}
input outboundCallPayloadInput {
    channel: ID
    agent: ID
    to: String
    PreContext: String
    expectedDuration: Int
    maxRetries: Int
    cps: Int
}
type Query {
    fetchJobs(campaignId: ID, status: jobStatusEnum, priority: Int, jobType: jobTypeEnum id: ID schedule_type: scheduleTypeEnum schedule_run_at: DateTime limit: Int page: Int): [Job]
    fetchCampaigns( id: ID, limit: Int page: Int ): [Campaign]
}
type Mutation {
    createCampaign(name: String, agentId: ID, receivers: [receiverInput], schedule: scheduleCampaignInput, cps: Int communicationChannels: [ID]): Campaign
    createJob(name: String, description: String, payload: outboundCallPayloadInput, schedule: scheduleJobInput, tags: [String], priority: Int): Job
    updateJobSchedule(id: ID, schedule: scheduleJobInput): Job
    deleteJob(id: ID): Boolean
}
`