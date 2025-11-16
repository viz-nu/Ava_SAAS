import axios from "axios";

export class ExotelService {
    constructor(apiKey, apiToken, accountSid, subdomain, region) {
        this.apiKey = apiKey;
        this.apiToken = apiToken;
        this.accountSid = accountSid;
        this.subdomain = "@" + subdomain;
        this.region = region;
    }
    async getAccountDetails() {
        try {
            const { data } = await axios.get(`https://api.exotel.com/v1/Accounts/${this.accountSid}.json`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`
                }
            });
            // expect 
            // { Sid: 'onewindowoverseaseducation1', FriendlyName: 'One Window Overseas Education', Type: 'Full', Status: 'active', DateCreated: '2025-05-16 17:27:41', DateUpdated: '2025-11-07 15:20:11', AuthToken: '527fd13190fd4508b6d1bacd762f22b3938dca16', Uri: null, BillingType: 'prepaid', KycStatus: 'completed' }
            return data.Account;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get account details: ${message}`);
        }

    }
    async existingPhoneNumbers(exophone_sid = "") {
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers${exophone_sid ? `/${exophone_sid}` : ''}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get existing phone numbers: ${message}`);
        }
    }
    async available_ExoPhones(country = 'IN', type = 'Landline', options = { IncomingSMS: 'No', InRegion: 'AP', Contains: '9494' }) {
        // IncomingSMS => Get only numbers that support incoming SMS.
        // InRegion =>  Get only numbers in the specified telecom circle. This filter is not applicable in all countries. For India, the currently supported regions are:
        // AP - Andhra Pradesh Circle
        // DL - Delhi Circle
        // KA - Karnataka Circle
        // KL - Kerala
        // MH - Maharashtra
        // MP - Madhya Pradesh
        // MU - Mumbai Circle
        // RJ - Rajasthan
        // TN - Tamilnadu
        // WB - West Bengal
        // Contains => Get numbers that contains the specified substring.
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/AvailablePhoneNumbers/${country}/${type}?${Object.entries(options).map(([key, value]) => `${key}=${value}`).join('&')}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get available exo phones: ${message}`);
        }
    }
    async buyPhoneNumber(phoneNumber, options = { VoiceUrl: "", SmsUrl: "", friendlyName: "" }) {
        const body = new URLSearchParams({
            PhoneNumber: phoneNumber,
            ...options,
        });

        try {
            const { data } = await axios.post(`
            https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`,
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to buy phone number: ${message}`);
        }
    }
    async assignPhoneNumberToFlow(exophone_sid, options = {}) { // for inbound calls
        const body = new URLSearchParams({
            ...options,
        });
        try {
            const { data } = await axios.put(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers/${exophone_sid}.json`,
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to assign phone number to flow: ${message}`);
        }
    }
    async deletePhoneNumber(exophone_sid) {
        try {
            const { data } = await axios.delete(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers/${exophone_sid}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to delete phone number: ${message}`);
        }
    }
    async outboundCallToFlow({ number, CallerId, webhookUrl, VoiceAppletId, customField }) {
        try {
            const formData = new URLSearchParams();
            formData.append('CallerId', CallerId);
            formData.append('From', number);
            formData.append('Url', `http://my.exotel.com/${this.accountSid}/exoml/start_voice/${VoiceAppletId}`);
            formData.append('StatusCallback', `${webhookUrl}`);
            formData.append('CustomField', JSON.stringify(customField));
            const { data } = await axios.post(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/connect.json`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            return data.Call;   // { Sid: 'f162cf479cce037eab49dd5d4fda19ba', ParentCallSid: null, DateCreated: '2025-11-10 16:56:32', DateUpdated: '2025-11-10 16:56:32', AccountSid: 'onewindowoverseaseducation1', To: '04045210835', From: '09959964639', PhoneNumberSid: '04045210835', Status: 'in-progress', StartTime: '2025-11-10 16:56:32', EndTime: null, Duration: null, Price: null, Direction: 'outbound-api', AnsweredBy: null, ForwardedFrom: null, CallerName: null, Uri: '/v1/Accounts/onewindowoverseaseducation1/Calls/f162cf479cce037eab49dd5d4fda19ba.json', RecordingUrl: null }
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to outbound call to flow: ${JSON.stringify(message)}`);
        }
    }
    /**
 * Get call details with optimized filters.
 *
 * @param {Object} filters
 *  - sids: string | string[]
 *  - dateFrom: 'YYYY-MM-DD HH:mm:ss'
 *  - dateTo: 'YYYY-MM-DD HH:mm:ss'
 *  - to: string | string[]
 *  - from: string | string[]
 *  - status: string | string[]
 *  - direction: string | string[]
 *  - phoneNumbers: string | string[]
 *  - minDuration: number (seconds)
 *  - maxDuration: number (seconds)
 *  - minPrice: number
 *  - maxPrice: number
 *  - pageSize: number (max 100)
 *  - sortBy: 'DateCreated:asc' | 'DateCreated:desc'
 *  - before: string
 *  - after: string
 *  - details: boolean
 *  - recordingUrlValidity: number (5–60 minutes)
 */
    async getCallDetails(filters = {}) {
        try {
            const { sids, dateFrom, dateTo, to, from, status, direction, phoneNumbers, minDuration, maxDuration, minPrice, maxPrice, pageSize, sortBy, before, after, details, recordingUrlValidity, } = filters;
            const params = {};
            // Sid (one or multiple)
            if (sids) params.Sid = Array.isArray(sids) ? sids.join(",") : sids;
            // DateCreated (gte:..;lte:..)
            if (dateFrom || dateTo) {
                const parts = [];
                if (dateFrom) parts.push(`gte:${dateFrom}`);
                if (dateTo) parts.push(`lte:${dateTo}`);
                params.DateCreated = parts.join(";"); // AND operator is ';'
            }
            // To / From / PhoneNumber – can be comma separated lists
            if (to) params.To = Array.isArray(to) ? to.join(",") : to;
            if (from) params.From = Array.isArray(from) ? from.join(",") : from;
            if (phoneNumbers) params.PhoneNumber = Array.isArray(phoneNumbers) ? phoneNumbers.join(",") : phoneNumbers;
            // Status – comma-separated OR
            if (status) params.Status = Array.isArray(status) ? status.join(",") : status;
            // Direction – comma-separated OR
            if (direction) params.Direction = Array.isArray(direction) ? direction.join(",") : direction;
            // Duration – with operators gte/lte
            if (minDuration || maxDuration) {
                const parts = [];
                if (minDuration != null) parts.push(`gte:${minDuration}s`);
                if (maxDuration != null) parts.push(`lte:${maxDuration}s`);
                params.Duration = parts.join(";");
            }
            // Price – with operators
            if (minPrice != null || maxPrice != null) {
                const parts = [];
                if (minPrice != null) parts.push(`gte:${minPrice}`);
                if (maxPrice != null) parts.push(`lte:${maxPrice}`);
                params.Price = parts.join(";");
            }
            // Pagination & sorting
            if (pageSize) params.PageSize = pageSize;
            if (sortBy) params.SortBy = sortBy; // e.g. 'DateCreated:asc' or 'DateCreated:desc'
            if (before) params.Before = before;
            if (after) params.After = after;
            // details=true for leg-wise info
            if (details === true) params.details = true;
            // RecordingUrlValidity (5-60 minutes)
            if (recordingUrlValidity) params.RecordingUrlValidity = recordingUrlValidity;
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Calls.json`, { params });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get call details: ${message}`);
        }
    }
    async getSingleCallDetails(callSid) {
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/${callSid}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get single call details: ${message}`);
        }
    }
    async NumberLookup(phoneNumber) {
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Numbers/${phoneNumber}.json`);
            return data;
            // {
            //     "Numbers": {
            //         "PhoneNumber": "0XXXXX30240",
            //             "Circle": "GJ",
            //                 "CircleName": "Gujarat Telecom Circle (includes Daman & Diu, Dadra & Nagar Haveli)",
            //                     "Type": "Mobile", 'Mobile' or 'Landline'
            //                         "Operator": "R",

            // Operator Name	Value
            // AC	Aircel
            // A	Airtel
            // AL	Allianz
            // B	BSNL
            // D	Dishnet
            // E	Etisalat
            // H	HFCL
            // I	Idea
            // LO	Loop
            // MT	MTNL
            // P	Ping
            // R	Reliance
            // S	Sistema
            // ST	S Tel
            // T	Tata
            // U	Unitech
            // VI	Videocon
            // V	Vodafone
            //                             "OperatorName": "Reliance",
            //                                 "DND": "Yes"
            //     }
            // }
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get number lookup: ${message}`);
        }
    }
    async createCampaign(name, agentId, receivers, schedule, cps, communicationChannel, instructions) {
        const startSchedule = new Date(schedule.startAt).toISOString();
        const endSchedule = new Date(schedule.endAt).toISOString();
        const customField = {}
        let body = {
            from: receivers.map(receiver => receiver.personalInfo.contactDetails.phone),
            // lists: incase of contact list,
            caller_id: communicationChannel.config.phoneNumber, // exophone sid
            url: `http://my.exotel.com/${this.accountSid}/exoml/start_voice/${communicationChannel.config.exotelVoiceAppletId}`,
            campaign_type: "dynamic",
            name: name,
            mode: "auto",
            retries: {
                number_of_retries: 3,
                interval_mins: 2,
                mechanism: "Exponential",
                on_status: ["busy", "no-answer", "failed"]
            },
            schedule: {
                send_at: startSchedule,
                end_at: endSchedule,
            },
            call_status_callback: `${process.env.EXOTEL_CALLBACK_URL}/call/status`,
            call_schedule_callback: `${process.env.EXOTEL_CALLBACK_URL}/call/schedule`,
            status_callback: `${process.env.EXOTEL_CALLBACK_URL}/campaign/status`,
            throttle: 60,
            custom_field: JSON.stringify(customField),
        }

        // POST https://<your_api_key>:<your_api_token><subdomain>/v2/accounts/<your_sid>/campaigns
        //         The following are the POST parameters:

        //         Parameter Name 	 Mandatory / Optional	Value
        //         from	Mandatory	Comma separated list of phone numbers that will be called.Preferably in E.164 format.If not set, our system will try to match it with a country and make a call.If landline number, prefix it with STD code; Ex: 0XXXXXX2400.Default is 1 and Max is 5000
        //         lists	Optional	
        //         Array of listSid.Up to 5 listSid can be part of one single campaign if optional parameter campaign type is selected as "static".If optional parameter campaign type is selected as "dynamic" then only one listSid is allowed.If no campaign type parameter is selected then the campaign by default runs as a "static" campaign.Either 'from' parameter or 'lists' parameter should be present in the API request

        //         caller_id	Mandatory	This is your ExoPhone(pick one from here)
        //         campaign_type	Optional	
        //         This will be "static" by default. In case, a Dynamic Campaign has to be scheduled then this value will be "dynamic"

        //         flow_type	Optional	
        //         In case of Creating an IVR through the campaign module, defining "ivr" is mandatory.The parameter name is "ivr".If read_via_text is opted then this value will be "greeting". 

        //         This is not applicable if you are selecting a flow.

        //         repeat_menu_attempts	Optional	
        //         If the flow_type is selected as "ivr" then this value can be specified to repeat the IVR menu.

        //         The default value will be 0 if the flow_type is set as "ivr". 

        //         This field is not applicable if flow_type is "greeting"

        //         url	Optional	
        //         Only applicable if you are selecting a call flow.

        //     http://my.exotel.com/{your_sid}/exoml/start_voice/{app_id} where app_id is the identiﬁer of the flow (or applet) that you want to connect to once the from number picks up the call. You can get the app_id from your Exotel Dashboard

        //         read_via_text	Optional	
        //         If the flow_type is opted for "ivr" or "greeting", then this field has to be entered with the content that has to be played out to the caller.You can enter a static content(no variables) or Dynamic content.In case, dynamic content is entered then "@@" has to be entered with the header value.Ensure that the header is the exact match from the list uploaded.For ex: If the header name in the file is FirstName then in the content entered here the dynamic variable has to be "@@FirstName"

        //         If flow / url is opted then this field would not be required. 



        //         name	Optional	
        //         It's an optional parameter in the request but mandatory in the response. It is used to define the name of the campaign. It should be greater than 3 characters and if not passed, its default value will be created using the 'AccountSID CurrentDate CurrentTime' and passed in the response.

        // Example: exotel 2021-06-04 11: 11: 10

        // type Optional	
        //         It's an optional parameter in the request but mandatory in the response. It's allowed(and default ) value is 'trans'.If not passed in the request, we will create campaign as type 'trans' and pass this parameter in the API response.As per regulations, we support only transactional type of campaigns.

        //     call_duplicate_numbers

        // Optional
        // Type: boolean

        //         Allowed Values: 'true' & 'false'

        //         Default Value: 'false'

        //         If 'true', Campaign will try calling the duplicate numbers present in the list(s).If 'false', Campaign will call any number in the list(s) only once.It is independent of the 'retry' functionality.

        //         retries	Optional
        // Object;Retry logic in case the calls are not successful.

        //     number_of_retries - The number of times a call to a phone number should be attempted.Default is 0 and max is 3.
        // interval_mins - The time interval between retries in mins.Mandatory when number_of_retries is specified
        // mechanism - either "Linear" or "Exponential".If the retry should be equally spaced or exponentially.Default is linear.
        //     on_status - Array; Determines when should campaign treat a call as an unsuccessful attempt.Could be "busy", "no-answer", "failed"
        //         schedule	Optional
        // Array;Determines when to start and end a campaign in RFC 3339 date - time

        // send_at - Time when the campaign should start.Default is to start now.
        //     end_at - Time when the campaign should end even if all calls are not attempted as part of the campaign.Default + 30 days from now or send_at time.This time is always strictly adhered to even there are calls pending to be made
        //         call_status_callback	Optional	
        //         When the call completes, an HTTP POST will be made to the provided URL with the following four parameters:

        // campaign_sid - an alpha - numeric unique identifier of this campaign
        // call_sid - an alpha - numeric unique identifier of this call
        // date_created - time when the resource was created
        // date_updated - time when the was updated
        // number - number to which the call was made
        // status - one of: completed, no - answer, busy, failed
        //         call_schedule_callback	Optional	
        //         When all calls to a number were completed including retries, an HTTP POST will be made to the provided URL with the following four parameters:

        // campaign_sid - an alpha - numeric unique identifier of this campaign
        // to - the number to which the call was made
        // from - the Exophone used in the campaign
        // date_created - time when the resource was created
        // date_updated - time when the resource was updated
        // call_sids - Object; includes all the call_sids and status of the calls that were made as part of this schedule
        // status - one of completed, busy, no - answer, failed
        //         status_callback	Optional	
        //         When the call campaign starts or ends, an HTTP POST will be made to the provided URL with the following four parameters:

        // campaign_sid - an alpha - numeric unique identifier of this campaign
        // date_created - time when the campaign resource was created
        // date_updated - time when the campaign was updated
        // date_started - time when the campaign started
        // status - one of: in -progress, completed, failed, canceled
        // reports - link to the campaign reports
        //         mode	Optional	
        //         This can be "auto" or "custom".

        //     Auto - This will be a default in which the campaign service will distribute the throttle of the campaign automatically

        // Custom - The throttle value can be set based on the desired campaign priority. 

        //         throttle	Optional	
        //         Only if Mode is selected as "Custom" this parameter will be applicable.The allowed value will be between 1 to(Campaign account throttle minus 1). 

        //         To know your Campaign Account throttle you can visit the Campaign settings page of your Exotel Account. 

        //         custom_field	Optional	Any application - specific value that will be passed back as a parameter while doing a GET request to the URL mentioned in your Passthru Applet or Greetings Applet.It is also provided as part of the campaigns report



    }




}