
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
    payload: outboundCallPayload | null
    result_ref: JSON | null
    error_ref: JSON | null
    log: logEntry | null
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
    accessToken: String
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
type scheduleTypeEnum {
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
type backoffTypeEnum {
    fixed
    exponential
}
type Campaign {
    _id: ID!
    name: String
    agent: Agent
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
    communicationChannels: [Channel]
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
Query {
    fetchJobs(campaignId: ID, status: jobStatusEnum, priority: Int, jobType: jobTypeEnum id: ID schedule_type: scheduleTypeEnum schedule_run_at: DateTime limit: Int page: Int): [Job]
    fetchCampaigns( id: ID, limit: Int page: Int ): [Campaign]
}
Mutation {
    createCampaign(name: String, agentId: ID, receivers: [Receiver], schedule: scheduleCampaign, cps: Int): Campaign
    createJob(name: String, description: String, payload: outboundCallPayload, schedule: scheduleJob, tags: [String], priority: Int): Job
    updateJobSchedule(id: ID, schedule: scheduleJob): Job
    deleteJob(id: ID): Boolean
}
`