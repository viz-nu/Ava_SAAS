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
  listAvailableNumbers(channelId: ID! country: String type: [type] areaCode: Int limit:Int): [PhoneNumber]
  listOwnedPhoneNumbers(channelId: ID!  limit:Int): [PhoneNumber]
  fetchBalance(channelId: ID!): Balance
  getSmsStatus(channelId: ID! sid: String!):SMSResponse
  # listCallRecordings(channelId: ID!  limit: Int): [Recording]
  listConnectApps(channelId: ID!): [ConnectApp]
  # listNotifications(channelId: ID!  limit: Int): [Notification]
  getMessages(channelId: ID! limit:Int  to:String  from:String  dateSent:DateTime  dateSentBefore:DateTime  dateSentAfter:DateTime  pageSize:Int):[SMSResponse]
}

type Mutation {
  buyPhoneNumber(channelId: ID!  phoneNumber: String!  friendlyName: String!): PhoneNumber
  releasePhoneNumber(channelId: ID!  sid: String!): PhoneNumber
  makeOutboundCall(channelId: ID!  to: String!  from: String!  twimlUrl: String!): Call
  sendSms(channelId: ID!  to: String!  from: String!  body: String!): SMSResponse
  deAuthorizeApp(channelId: ID!  connectAppSid: String!): Boolean
}

`;