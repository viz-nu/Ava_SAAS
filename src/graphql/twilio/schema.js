export const twilioTypeDefs = `#graphql
 enum TwilioCountryEnum {
    AD, # Andorra
    AE, # United Arab Emirates
    AF, # Afghanistan
    AG, # Antigua and Barbuda
    AL, # Albania
    AM, # Armenia
    AO, # Angola
    AR, # Argentina
    AU, # Australia
    AT, # Austria
    AW, # Aruba
    AZ, # Azerbaijan
    BB, # Barbados
    BD, # Bangladesh
    BE, # Belgium
    BF, # Burkina Faso
    BG, # Bulgaria
    BH, # Bahrain
    BJ, # Benin
    BO, # Bolivia
    BR, # Brazil
    BS, # The Bahamas
    BW, # Botswana
    BY, # Belarus
    BZ, # Belize
    CA, # Canada
    CH, # Switzerland
    CL, # Chile
    CN, # China
    CO, # Colombia
    CR, # Costa Rica
    CU, # Cuba
    CY, # Cyprus
    CZ, # Czech Republic
    DE, # Germany
    DK, # Denmark
    DO, # Dominican Republic
    DZ, # Algeria
    EC, # Ecuador
    EE, # Estonia
    EG, # Egypt
    ES, # Spain
    FI, # Finland
    FJ, # Fiji
    FR, # France
    GB, # United Kingdom
    GE, # Georgia
    GH, # Ghana
    GR, # Greece
    GT, # Guatemala
    HK, # Hong Kong
    HN, # Honduras
    HU, # Hungary
    ID, # Indonesia
    IE, # Ireland
    IL, # Israel
    IN, # India
    IQ, # Iraq
    IS, # Iceland
    IT, # Italy
    JM, # Jamaica
    JO, # Jordan
    JP, # Japan
    KE, # Kenya
    KH, # Cambodia
    KR, # South Korea
    KW, # Kuwait
    LA, # Laos
    LB, # Lebanon
    LI, # Liechtenstein
    LK, # Sri Lanka
    LT, # Lithuania
    LU, # Luxembourg
    LV, # Latvia
    MA, # Morocco
    MD, # Moldova
    ME, # Montenegro
    MX, # Mexico
    MY, # Malaysia
    NG, # Nigeria
    NL, # Netherlands
    NO, # Norway
    NP, # Nepal
    NZ, # New Zealand
    OM, # Oman
    PA, # Panama
    PE, # Peru
    PH, # Philippines
    PK, # Pakistan
    PL, # Poland
    PR, # Puerto Rico
    PT, # Portugal
    QA, # Qatar
    RO, # Romania
    RS, # Serbia
    RU, # Russia
    SA, # Saudi Arabia
    SC, # Seychelles
    SE, # Sweden
    SG, # Singapore
    SI, # Slovenia
    SK, # Slovakia
    SM, # San Marino
    SN, # Senegal
    SO, # Somalia
    SV, # El Salvador
    SY, # Syria
    TH, # Thailand
    TR, # Turkey
    UA, # Ukraine
    UG, # Uganda
    US, # United States
    UY, # Uruguay
    VA, # Vatican City
    VE, # Venezuela
    VN, # Vietnam
    YE, # Yemen
    ZA # South Africa
}

"""Capabilities for a phone number"""
type Capabilities {
  voice: Boolean
  SMS: Boolean
  MMS: Boolean
}
enum CallStatusEnum{
  queued
  ringing
  inProgress
  completed
  busy
  failed
  noAnswer
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
    isoCountry: TwilioCountryEnum
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
  duration: String
  price: String
  priceUnit: String
  direction: String
  startTime: DateTime
  endTime: DateTime
  answeredBy: String
  forwardedFrom: String
  parentCallSid: String
  callerName: String
  groupSid: String
  queueTime: String
  trunkSid: String
}
"""Recording detail"""
type Recording {
    sid: String
    duration: String
    startTime: DateTime
    dateCreated: DateTime
    callSid: String
    conferenceSid: String
    mediaUrl: String 
    price: String
    priceUnit: String
    source: String
    channels: Int
    errorCode: String
    status: String
}
"""SMS or MMS message detail"""
type Message {
  sid: String
  body: String
  to: String
  from: String
  status: String
  dateCreated: DateTime
  dateUpdated: DateTime
  dateSent: DateTime
  direction: String
  errorCode: String
  errorMessage: String
  numSegments: String
  numMedia: String
  price: String
  priceUnit: String
  messagingServiceSid: String
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
 enum TwilioUsageRecordsCategoryEnum{
    calls
    sms 
    }
    enum TwilioServicesEnum{
      voice
        phoneNumbers
        messaging
    }
enum TwilioUsageRecordsInstance{
    today
    yesterday
    thisMonth
    lastMonth
    yearly
    allTime
    daily
    monthly
    }
type TwilioUsage{
  asOf: DateTime
    description: String
    category: String
    period: String
    usage: String
    usageUnit: String
    count: String
    countUnit: String
    price: String
    priceUnit: String
    startDate: DateTime
    endDate: DateTime
}
type Query {
  getTwilioAccountDetails(integrationId: ID!): TwilioAccountDetails @requireScope(scope: "integration:read") @requireBusinessAccess
  listTwilioAvailableNumbers(integrationId: ID! country: TwilioCountryEnum! type: [TwilioPhoneNumberType] options:TwilioPhoneNumberListOptions): [PhoneNumber] @requireScope(scope: "integration:read") @requireBusinessAccess
  listTwilioOwnedPhoneNumbers(integrationId: ID!  limit:Int): [PhoneNumber] @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioSmsStatus(integrationId: ID! sid: String!):SMSResponse @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioMessages(integrationId: ID! limit:Int  to:String  from:String  dateSent:DateTime  dateSentBefore:DateTime  dateSentAfter:DateTime  pageSize:Int):[SMSResponse] @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioCalls(integrationId: ID! limit:Int  to:String  from:String  startTime:DateTime  endTime:DateTime  status:CallStatusEnum):[Call] @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioCallRecordings(integrationId: ID! callSid:ID dateCreated:DateTime limit:Int): [Recording] @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioUsageRecords(integrationId: ID! category:TwilioUsageRecordsCategoryEnum! startDate:DateTime endDate:DateTime limit:Int): [TwilioUsage] @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioUsageRecordsTimely(integrationId: ID! limit:Int Instance:TwilioUsageRecordsInstance! year:Int): [TwilioUsage] @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioPricing(integrationId: ID! country: TwilioCountryEnum! twilioService:TwilioServicesEnum!): JSON @requireScope(scope: "integration:read") @requireBusinessAccess
  getTwilioTranscriptions(integrationId: ID! callSid:ID ):JSON @requireScope(scope: "integration:read") @requireBusinessAccess
}

type Mutation {
  buyTwilioPhoneNumber(integrationId: ID!  phoneNumber: String!  friendlyName: String! voiceUrl:String smsUrl:String): PhoneNumber @requireScope(scope: "integration:update") @requireBusinessAccess
  updateTwilioPhoneNumber(integrationId: ID!  sid: String! friendlyName: String voiceUrl: String voiceMethod: String smsUrl: String smsMethod: String voiceCallerIdLookup: Boolean accountSid: String): PhoneNumber @requireScope(scope: "integration:update") @requireBusinessAccess
  releaseTwilioPhoneNumber(integrationId: ID!  sid: String!): PhoneNumber @requireScope(scope: "integration:update") @requireBusinessAccess
  makeTwilioOutboundTestCall(channelId: ID! to:String!): Call @requireBusinessAccess
  makeTwilioAIOutboundCall(channelId: ID! to:String! agentId:ID! PreContext:String campaignId:ID): ID  @requireBusinessAccess
  sendTwilioSms(integrationId: ID!  to: String!  from: String!  body: String! statusCallback:String mediaUrl:[String]): SMSResponse @requireBusinessAccess
}
`;
