import axios from "axios";

export class ExotelService {
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

    async createCampaign(VoiceAppletId, CallerId, contacts, schedule = null) {
        // const startSchedule = new Date(schedule.startAt).toISOString();
        // const endSchedule = new Date(schedule.endAt).toISOString();
        const body = {
            "campaigns": [{
                from: contacts.map(contact => contact.phoneNumber),
                // lists: incase of contact list,
                caller_id: CallerId, // exophone sid
                url: `http://my.exotel.com/${this.accountSid}/exoml/start_voice/${VoiceAppletId}`,
                campaign_type: "static",
                name: `Campaign ${new Date().toISOString()}`,
                mode: "auto",
                retries: {
                    number_of_retries: 3,
                    interval_mins: 2,
                    mechanism: "Linear",
                    on_status: ["busy", "no-answer", "failed"]
                },
                schedule,
                // call_status_callback: `${process.env.EXOTEL_CALLBACK_URL}/call/status`,
                // call_schedule_callback: `${process.env.EXOTEL_CALLBACK_URL}/call/schedule`,
                // status_callback: `${process.env.EXOTEL_CALLBACK_URL}/campaign/status`,
                // throttle: 60,
                custom_field: JSON.stringify({ isCampaign: true }),
            }]
        }
        try {
            const { data } = await axios.post(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2/accounts/${this.accountSid}/campaigns`, body);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to create campaign: ${JSON.stringify(message)}`);
        }
    }

}