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
enum TwilioPhoneNumberType {
  local
  mobile
  tollFree
}
type Balance{
  accountSid:String
  balance:String
  currency:String
}
type TwilioAccountDetails{
      dateCreated: DateTime
      dateUpdated: DateTime
      friendlyName: String
      status: String
      type: String
}
input TwilioPhoneNumberListOptions{
    areaCode:String,
    smsEnabled:Boolean,
    voiceEnabled:Boolean,
    excludeAllAddressRequired:Boolean,
    excludeLocalAddressRequired:Boolean,
    excludeForeignAddressRequired: Boolean, 
     nearNumber: String,
    nearLatLong: String,
     distance: Int                     
     inPostalCode: String,          
    inRegion: String,              
    inRateCenter: String,          
    inLata:String,
    limit:Int
 }
type Query {
  getTwilioAccountDetails(integrationId: ID!): TwilioAccountDetails @requireScope(scope: "integration:read") @requireBusinessAccess
  listTwilioAvailableNumbers(integrationId: ID! country: String type: [TwilioPhoneNumberType] options:TwilioPhoneNumberListOptions): [PhoneNumber] @requireScope(scope: "integration:read") @requireBusinessAccess
  listTwilioOwnedPhoneNumbers(integrationId: ID!  limit:Int): [PhoneNumber] @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioSmsStatus(integrationId: ID! sid: String!):SMSResponse @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioMessages(integrationId: ID! limit:Int  to:String  from:String  dateSent:DateTime  dateSentBefore:DateTime  dateSentAfter:DateTime  pageSize:Int):[SMSResponse] @requireScope(scope: "integration:read") @requireBusinessAccess
  # listCallRecordings(integrationId: ID!  limit: Int): [Recording]
  # listNotifications(integrationId: ID!  limit: Int): [Notification]
}

type Mutation {
  buyTwilioPhoneNumber(integrationId: ID!  phoneNumber: String!  friendlyName: String!): PhoneNumber @requireScope(scope: "integration:update") @requireBusinessAccess
  updateTwilioPhoneNumber(integrationId: ID!  sid: String! friendlyName: String voiceUrl: String voiceMethod: String smsUrl: String smsMethod: String voiceCallerIdLookup: Boolean accountSid: String): PhoneNumber @requireScope(scope: "integration:update") @requireBusinessAccess
  releaseTwilioPhoneNumber(integrationId: ID!  sid: String!): PhoneNumber @requireScope(scope: "integration:update") @requireBusinessAccess
  makeTwilioOutboundCall(integrationId: ID!  to: String!  from: String! twiml:String record:Boolean statusCallback:String timeout:Int machineDetection:String machineDetectionTimeout:Int recordingStatusCallback:String ): Call @requireBusinessAccess
  makeTwilioAIOutboundCall(integrationId: ID! to:String! agentId:ID! ): Call  @requireBusinessAccess
  sendTwilioSms(integrationId: ID!  to: String!  from: String!  body: String! statusCallback:String mediaUrl:[String]): SMSResponse @requireBusinessAccess
  deAuthorizeTwilioApp(integrationId: ID!  connectAppSid: String!): Boolean @requireScope(scope: "integration:delete") @requireBusinessAccess
}

`;
