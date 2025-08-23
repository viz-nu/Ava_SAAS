export const twilioTypeDefs = `#graphql
"""Capabilities for a phone number"""
type Capabilities {
  voice: Boolean
  SMS: Boolean
  MMS: Boolean
}
"""Phone number resource including cost details"""
type PhoneNumber {
    sid: String
    lata: String
    locality: String
    rateCenter:String
    latitude:String
    longitude: String
    region: String
    postalCode: String
    isoCountry: String
    addressRequirements: String
    beta: Boolean
    capabilities: Capabilities
    phoneNumber: String
    friendlyName: String
    cost:JSON
  }

"""Call detail"""
type Call {
  sid: String
  to: String
  from: String
  status: String
}

"""SMS or MMS message detail"""
type Message {
  sid: String
  body: String
  to: String
  from: String
  status: String
}
"""Recording details"""
type Recording {
  sid: String
  duration: String
  dateCreated: String
  callSid: String
  uri: String
}


"""Connect App details"""
type ConnectApp {
  sid: String
  companyName: String
  description: String
  homepageUrl: String
  permissions: [String]
}

"""Notification details from Twilio errors or warnings"""
type Notification {
  sid: String
  messageText: String
  log: String
  errorCode: Int
  moreInfo: String
  requestUrl: String
  requestMethod: String
}
type SMSResponse{
  body: String
  direction: String
  from: String
  to: String
  dateUpdated: DateTime
  price: String
  errorMessage: String
  status: String
  sid: String
  dateSent: DateTime
  dateCreated: DateTime
  errorCode: String
  priceUnit: String                                                                              
}

"""Enum for phone number types"""
enum type {
  local
  mobile
  tollFree
}
type Balance{
  accountSid:String
  balance:String
  currency:String
}
type Query {
  listAvailableNumbers(integrationId: ID! country: String type: [type] areaCode: Int limit:Int): [PhoneNumber]
  listOwnedPhoneNumbers(integrationId: ID!  limit:Int): [PhoneNumber]
  fetchBalance(integrationId: ID!): Balance
  getSmsStatus(integrationId: ID! sid: String!):SMSResponse
  # listCallRecordings(integrationId: ID!  limit: Int): [Recording]
  listConnectApps(integrationId: ID!): [ConnectApp]
  # listNotifications(integrationId: ID!  limit: Int): [Notification]
  getMessages(integrationId: ID! limit:Int  to:String  from:String  dateSent:DateTime  dateSentBefore:DateTime  dateSentAfter:DateTime  pageSize:Int):[SMSResponse]
}

type Mutation {
  buyPhoneNumber(integrationId: ID!  phoneNumber: String!  friendlyName: String!): PhoneNumber
  releasePhoneNumber(integrationId: ID!  sid: String!): PhoneNumber
  makeOutboundCall(integrationId: ID!  to: String!  from: String!  twimlUrl: String!): Call
  makeAIOutboundCall(integrationId: ID! to:String! agentId:ID! ): Call
  sendSms(integrationId: ID!  to: String!  from: String!  body: String!): SMSResponse
  deAuthorizeApp(integrationId: ID!  connectAppSid: String!): Boolean
}

`;