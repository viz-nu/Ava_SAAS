
export const jobTypeDefs = `#graphql
type Campaign {
    _id: ID!
    name: String!
    channel: Channel
    leads: [Lead]
    config: JSON
    status: String
    timeLines: JSON
    cancel_requested: Boolean
    createdBy: User
    createdAt: DateTime
    updatedAt: DateTime
}
    type Task {
        _id: ID!
        business: Business
        campaign: Campaign
        lead: Lead
        status: String
        timeLine: JSON
        createdAt: DateTime
        type: String
        data: JSON
        error: JSON
        updatedAt: DateTime
    }
    type CampaignPagination {
        data: [Campaign]
        metaData: JSON
    }
    type TaskPagination {
        data: [Task]
        metaData: JSON
    }
      type  Query {
            fetchCampaigns(id: ID, name: String, channelIds: [ID], leadIds: [ID], status: String, limit: Int, page: Int): CampaignPagination
            fetchTasks(campaignId: ID, status: String, limit: Int, page: Int): TaskPagination
        }
       type Mutation {
            createCampaign(name: String, channelId: ID, leadIds: [ID], config: JSON, scheduledAt: DateTime): Campaign
            cancelCampaign(id: ID): Campaign
        }
`