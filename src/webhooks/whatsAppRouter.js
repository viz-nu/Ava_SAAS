import { Router } from "express";
import { parse } from "url";
import { sendWAMessage } from "../utils/WA.js";
import { generateAIResponse } from "../utils/openai.js";
export const whatsappRouter = Router()
whatsappRouter.get('/:params', async (req, res) => {
    try {
        const parsedUrl = parse(req.originalUrl, true);
        const query = parsedUrl.query;
        const mode = query['hub.mode'];
        const token = query['hub.verify_token'];
        const challenge = query['hub.challenge'];
        console.log("Mode:", mode);
        console.log("Verify Token:", token);
        console.log("Challenge:", challenge);
        console.log("Params:", req.params);
        console.log("Query:", query);
        // Optional: Verify the token before responding
        if (mode === 'subscribe' && token === process.env.META_VERIFICATION_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    } catch (error) {
        console.error('Error in webhook verification:', error);
        res.sendStatus(500);
    }
});
whatsappRouter.post('/:params', async (req, res) => {
    try {
      const parsedUrl = parse(req.originalUrl, true);
      const query = parsedUrl.query;
      const params = req.params;
      console.log("➡️ Incoming webhook");
      console.log("📦 Params:", JSON.stringify(params, null, 2));
      console.log("🔍 Query:", JSON.stringify(query, null, 2));
      console.log("📨 Body:", JSON.stringify(req.body, null, 2));
      const body = req.body;
      if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
        // Process each entry in the webhook
        for (const entry of body.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              // Get the value object which contains all the important data
              const value = change.value;
              const phone_number_id= value.metadata.phone_number_id
              const messaging_product=value.messaging_product
              // Check if this is a message notification
              if (value.messages && Array.isArray(value.messages)) {
                // Process each message
                for (const message of value.messages) {
                  const from = message.from;
                  // Extract contact name from the contacts array
                  let contactName = null;
                  if (value.contacts && Array.isArray(value.contacts)) {
                    // Find the contact that matches the sender
                    const contact = value.contacts.find(c => c.wa_id === from);
                    if (contact && contact.profile && contact.profile.name) {
                      contactName = contact.profile.name;
                      console.log(`👤 Contact identified: ${contactName} (${from})`);
                    }
                  }
                  // Handle different message types
                  let userMessageText = "";
                  if (message.type === "text" && message.text) {
                    userMessageText = message.text.body;
                    console.log(`💬 Text message from ${contactName || from}: "${userMessageText}"`);
                  } else if (message.type === "image" && message.image) {
                    userMessageText = message.image.caption || "Image received (no caption)";
                    console.log(`📸 Image message from ${contactName || from}: "${userMessageText}"`);
                  } else if (message.type === "audio" && message.audio) {
                    userMessageText = "Audio message received";
                    console.log(`🔊 Audio message from ${contactName || from}`);
                  } else if (message.type === "document" && message.document) {
                    userMessageText = message.document.caption || "Document received (no caption)";
                    console.log(`📄 Document message from ${contactName || from}: "${userMessageText}"`);
                  } else {
                    userMessageText = `Message of type ${message.type} received`;
                    console.log(`📩 ${message.type} message from ${contactName || from}`);
                  }
                  try {
                    // Create a personalized system prompt with the user's name
                    const responseText = await generateAIResponse(userMessageText,contactName)
                    console.log(`🤖 AI Response to ${contactName || from}: "${responseText}"`);
                    // Send the AI response back to the user
                    await sendWAMessage({phone_number_id,messaging_product,to: from, type: "text",Data: {body:responseText}});
                    console.log(`✅ Response sent to ${contactName || from}`);
                  } catch (err) {
                    console.error(`❌ Error processing message from ${contactName || from}:`, err);
                  }
                }
              }
              // Handle status updates if present
              if (value.statuses && Array.isArray(value.statuses)) {
                value.statuses.forEach(status => {
                  console.log(`📈 Status update for message ${status.id}: ${status.status}`);
                  console.log(`👤 Recipient: ${status.recipient_id}`);
                  console.log(`🕒 Timestamp: ${status.timestamp}`);
                });
              }
            }
          }
        }
      }
      // Always acknowledge receipt to avoid retries
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('❌ Error in WhatsApp webhook:', error);
      return res.sendStatus(500);
    }
  });

//  body {
//    "object": "whatsapp_business_account",
//    "entry": [
//      {
//        "id": "1726944911223310",
//        "changes": [
//          {
//            "value": {
//              "messaging_product": "whatsapp",
//              "metadata": {
//                "display_phone_number": "918977507046",
//                "phone_number_id": "613445751852844"
//              },
//              "contacts": [
//                {
//                  "profile": {
//                    "name": "Viz"
//                  },
//                  "wa_id": "919490123143"
//                }
//              ],
//              "messages": [
//                {
//                  "from": "919490123143",
//                  "id": "wamid.HBgMOTE5NDkwMTIzMTQzFQIAEhgUM0E1N0NEOEE5REYyM0NGMzM0NEEA",
//                  "timestamp": "1744048050",
//                  "text": {
//                    "body": "hi"
//                  },
//                  "type": "text"
//                }
//              ]
//            },
//            "field": "messages"
//          }
//        ]
//      }
//    ]
//  }
//  Mon, 07 Apr 2025 17:47:56 GMT POST /webhook/whatsapp/93939393 - - - - ms
 

//  body {
//    "object": "whatsapp_business_account",
//    "entry": [
//      {
//        "id": "1726944911223310",
//        "changes": [
//          {
//            "value": {
//              "messaging_product": "whatsapp",
//              "metadata": {
//                "display_phone_number": "918977507046",
//                "phone_number_id": "613445751852844"
//              },
//              "contacts": [
//                {
//                  "profile": {
//                    "name": "Viz"
//                  },
//                  "wa_id": "919490123143"
//                }
//              ],
//              "messages": [
//                {
//                  "from": "919490123143",
//                  "id": "wamid.HBgMOTE5NDkwMTIzMTQzFQIAEhgUM0E1N0NEOEE5REYyM0NGMzM0NEEA",
//                  "timestamp": "1744048050",
//                  "text": {
//                    "body": "hi"
//                  },
//                  "type": "text"
//                }
//              ]
//            },
//            "field": "messages"
//          }
//        ]
//      }
//    ]
//  }
//  Mon, 07 Apr 2025 17:48:21 GMT POST /webhook/whatsapp/93939393 - - - - ms
 

//  body {
//    "object": "whatsapp_business_account",
//    "entry": [
//      {
//        "id": "101124146240155",
//        "changes": [
//          {
//            "value": {
//              "messaging_product": "whatsapp",
//              "metadata": {
//                "display_phone_number": "15550150740",
//                "phone_number_id": "100397339648368"
//              },
//              "statuses": [
//                {
//                  "id": "wamid.HBgMOTE5NDkwMTIzMTQzFQIAERgSN0UxOUE4QjAzRDcxNDc3ODNFAA==",
//                  "status": "sent",
//                  "timestamp": "1744005373",
//                  "recipient_id": "919490123143",
//                  "conversation": {
//                    "id": "ca818598ba5a788253f92748096c0001",
//                    "expiration_timestamp": "1744091820",
//                    "origin": {
//                      "type": "marketing"
//                    }
//                  },
//                  "pricing": {
//                    "billable": true,
//                    "pricing_model": "CBP",
//                    "category": "marketing"
//                  }
//                }
//              ]
//            },
//            "field": "messages"
//          }
//        ]
//      }
//    ]
//  }
//  Mon, 07 Apr 2025 17:50:03 GMT POST /webhook/whatsapp/93939393 - - - - ms
 

//  body {
//    "object": "whatsapp_business_account",
//    "entry": [
//      {
//        "id": "101124146240155",
//        "changes": [
//          {
//            "value": {
//              "messaging_product": "whatsapp",
//              "metadata": {
//                "display_phone_number": "15550150740",
//                "phone_number_id": "100397339648368"
//              },
//              "statuses": [
//                {
//                  "id": "wamid.HBgMOTE5NDkwMTIzMTQzFQIAERgSN0UxOUE4QjAzRDcxNDc3ODNFAA==",
//                  "status": "read",
//                  "timestamp": "1744005377",
//                  "recipient_id": "919490123143"
//                }
//              ]
//            },
//            "field": "messages"
//          }
//        ]
//      }
//    ]
//  }
//  Mon, 07 Apr 2025 17:50:32 GMT POST /webhook/whatsapp/93939393 - - - - ms
 

//  body {
//    "object": "whatsapp_business_account",
//    "entry": [
//      {
//        "id": "101124146240155",
//        "changes": [
//          {
//            "value": {
//              "messaging_product": "whatsapp",
//              "metadata": {
//                "display_phone_number": "15550150740",
//                "phone_number_id": "100397339648368"
//              },
//              "statuses": [
//                {
//                  "id": "wamid.HBgMOTE5NDkwMTIzMTQzFQIAERgSN0UxOUE4QjAzRDcxNDc3ODNFAA==",
//                  "status": "delivered",
//                  "timestamp": "1744005374",
//                  "recipient_id": "919490123143",
//                  "conversation": {
//                    "id": "ca818598ba5a788253f92748096c0001",
//                    "origin": {
//                      "type": "marketing"
//                    }
//                  },
//                  "pricing": {
//                    "billable": true,
//                    "pricing_model": "CBP",
//                    "category": "marketing"
//                  }
//                }
//              ]
//            },
//            "field": "messages"
//          }
//        ]
//      }
//    ]
//  }
//  Mon, 07 Apr 2025 17:51:09 GMT POST /webhook/whatsapp/93939393 - - - - ms
 

//  body {
//    "object": "whatsapp_business_account",
//    "entry": [
//      {
//        "id": "1726944911223310",
//        "changes": [
//          {
//            "value": {
//              "messaging_product": "whatsapp",
//              "metadata": {
//                "display_phone_number": "918977507046",
//                "phone_number_id": "613445751852844"
//              },
//              "contacts": [
//                {
//                  "profile": {
//                    "name": "Viz"
//                  },
//                  "wa_id": "919490123143"
//                }
//              ],
//              "messages": [
//                {
//                  "from": "919490123143",
//                  "id": "wamid.HBgMOTE5NDkwMTIzMTQzFQIAEhgUM0E1N0NEOEE5REYyM0NGMzM0NEEA",
//                  "timestamp": "1744048050",
//                  "text": {
//                    "body": "hi"
//                  },
//                  "type": "text"
//                }
//              ]
//            },
//            "field": "messages"
//          }
//        ]
//      }
//    ]
//  }
//  Mon, 07 Apr 2025 17:53:16 GMT POST /webhook/whatsapp/93939393 - - - - ms
 

//  body {
//    "object": "whatsapp_business_account",
//    "entry": [
//      {
//        "id": "1726944911223310",
//        "changes": [
//          {
//            "value": {
//              "messaging_product": "whatsapp",
//              "metadata": {
//                "display_phone_number": "918977507046",
//                "phone_number_id": "613445751852844"
//              },
//              "contacts": [
//                {
//                  "profile": {
//                    "name": "Viz"
//                  },
//                  "wa_id": "919490123143"
//                }
//              ],
//              "messages": [
//                {
//                  "from": "919490123143",
//                  "id": "wamid.HBgMOTE5NDkwMTIzMTQzFQIAEhgUM0E1N0NEOEE5REYyM0NGMzM0NEEA",
//                  "timestamp": "1744048050",
//                  "text": {
//                    "body": "hi"
//                  },
//                  "type": "text"
//                }
//              ]
//            },
//            "field": "messages"
//          }
//        ]
//      }
//    ]
//  }
//  Mon, 07 Apr 2025 17:53:43 GMT POST /webhook/whatsapp/93939393 - - - - ms
    
    
// ❌ Error sending WhatsApp message: AxiosError: Request failed with status code 400
//     at settle (file:///home/ubuntu/Ava_SAAS/node_modules/axios/lib/core/settle.js:19:12)
//     at BrotliDecompress.handleStreamEnd (file:///home/ubuntu/Ava_SAAS/node_modules/axios/lib/adapters/http.js:599:11)
//     at BrotliDecompress.emit (node:events:525:35)
//     at endReadableNT (node:internal/streams/readable:1696:12)
//     at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
//     at Axios.request (file:///home/ubuntu/Ava_SAAS/node_modules/axios/lib/core/Axios.js:45:41)
//     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
//     at async sendWAMessage (file:///home/ubuntu/Ava_SAAS/src/utils/WA.js:24:26)
//     at async file:///home/ubuntu/Ava_SAAS/src/webhooks/whatsAppRouter.js:85:21 {
//   code: 'ERR_BAD_REQUEST',
//   config: {
//     transitional: {
//       silentJSONParsing: true,
//       forcedJSONParsing: true,
//       clarifyTimeoutError: false
//     },
//     adapter: [ 'xhr', 'http', 'fetch' ],
//     transformRequest: [ [Function: transformRequest] ],
//     transformResponse: [ [Function: transformResponse] ],
//     timeout: 0,
//     xsrfCookieName: 'XSRF-TOKEN',
//     xsrfHeaderName: 'X-XSRF-TOKEN',
//     maxContentLength: -1,
//     maxBodyLength: -1,
//     env: { FormData: [Function [FormData]], Blob: [class Blob] },
//     validateStatus: [Function: validateStatus],
//     headers: Object [AxiosHeaders] {
//       Accept: 'application/json, text/plain, */*',
//       'Content-Type': 'application/json',
//       Authorization: 'Bearer ',
//       'User-Agent': 'axios/1.8.3',
//       'Content-Length': '172',
//       'Accept-Encoding': 'gzip, compress, deflate, br'
//     },
//     method: 'post',
//     url: 'https://graph.facebook.com/v20.0/phone_number_id/messages',
//     data: ``,
//     allowAbsoluteUrls: true
//   },
//   request: <ref *1> ClientRequest {
//     _events: [Object: null prototype] {
//       abort: [Function (anonymous)],
//       aborted: [Function (anonymous)],
//       connect: [Function (anonymous)],
//       error: [Function (anonymous)],
//       socket: [Function (anonymous)],
//       timeout: [Function (anonymous)],
//       finish: [Function: requestOnFinish]
//     },
//     _eventsCount: 7,
//     _maxListeners: undefined,
//     outputData: [],
//     outputSize: 0,
//     writable: true,
//     destroyed: true,
//     _last: false,
//     chunkedEncoding: false,
//     shouldKeepAlive: true,
//     maxRequestsOnConnectionReached: false,
//     _defaultKeepAlive: true,
//     useChunkedEncodingByDefault: true,
//     sendDate: false,
//     _removedConnection: false,
//     _removedContLen: false,
//     _removedTE: false,
//     strictContentLength: false,
//     _contentLength: '172',
//     _hasBody: true,
//     _trailer: '',
//     finished: true,
//     _headerSent: true,
//     _closed: true,
//     _header: 'POST /v20.0/phone_number_id/messages HTTP/1.1\r\n' +
//       'Accept: application/json, text/plain, */*\r\n' +
//       'Content-Type: application/json\r\n' +
//       'Authorization: Bearer \r\n' +
//       'User-Agent: axios/1.8.3\r\n' +
//       'Content-Length: 172\r\n' +
//       'Accept-Encoding: gzip, compress, deflate, br\r\n' +
//       'Host: graph.facebook.com\r\n' +
//       'Connection: keep-alive\r\n' +
//       '\r\n',
//     _keepAliveTimeout: 0,
//     _onPendingData: [Function: nop],
//     agent: Agent {
//       _events: [Object: null prototype],
//       _eventsCount: 2,
//       _maxListeners: undefined,
//       defaultPort: 443,
//       protocol: 'https:',
//       options: [Object: null prototype],
//       requests: [Object: null prototype] {},
//       sockets: [Object: null prototype] {},
//       freeSockets: [Object: null prototype],
//       keepAliveMsecs: 1000,
//       keepAlive: true,
//       maxSockets: Infinity,
//       maxFreeSockets: 256,
//       scheduling: 'lifo',
//       maxTotalSockets: Infinity,
//       totalSocketCount: 1,
//       maxCachedSessions: 100,
//       _sessionCache: [Object],
//       [Symbol(shapeMode)]: false,
//       [Symbol(kCapture)]: false
//     },
//     socketPath: undefined,
//     method: 'POST',
//     maxHeaderSize: undefined,
//     insecureHTTPParser: undefined,
//     joinDuplicateHeaders: undefined,
//     path: '/v20.0/phone_number_id/messages',
//     _ended: true,
//     res: IncomingMessage {
//       _events: [Object],
//       _readableState: [ReadableState],
//       _maxListeners: undefined,
//       socket: null,
//       httpVersionMajor: 1,
//       httpVersionMinor: 1,
//       httpVersion: '1.1',
//       complete: true,
//       rawHeaders: [Array],
//       rawTrailers: [],
//       joinDuplicateHeaders: undefined,
//       aborted: false,
//       upgrade: false,
//       url: '',
//       method: null,
//       statusCode: 400,
//       statusMessage: 'Bad Request',
//       client: [TLSSocket],
//       _consuming: true,
//       _dumped: false,
//       req: [Circular *1],
//       _eventsCount: 4,
//       responseUrl: 'https://graph.facebook.com/v20.0/phone_number_id/messages',
//       redirects: [],
//       [Symbol(shapeMode)]: true,
//       [Symbol(kCapture)]: false,
//       [Symbol(kHeaders)]: [Object],
//       [Symbol(kHeadersCount)]: 50,
//       [Symbol(kTrailers)]: null,
//       [Symbol(kTrailersCount)]: 0
//     },
//     aborted: false,
//     timeoutCb: null,
//     upgradeOrConnect: false,
//     parser: null,
//     maxHeadersCount: null,
//     reusedSocket: false,
//     host: 'graph.facebook.com',
//     protocol: 'https:',
//     _redirectable: Writable {
//       _events: [Object],
//       _writableState: [WritableState],
//       _maxListeners: undefined,
//       _options: [Object],
//       _ended: true,
//       _ending: true,
//       _redirectCount: 0,
//       _redirects: [],
//       _requestBodyLength: 172,
//       _requestBodyBuffers: [],
//       _eventsCount: 3,
//       _onNativeResponse: [Function (anonymous)],
//       _currentRequest: [Circular *1],
//       _currentUrl: 'https://graph.facebook.com/v20.0/phone_number_id/messages',
//       [Symbol(shapeMode)]: true,
//       [Symbol(kCapture)]: false
//     },
//     [Symbol(shapeMode)]: false,
//     [Symbol(kCapture)]: false,
//     [Symbol(kBytesWritten)]: 0,
//     [Symbol(kNeedDrain)]: false,
//     [Symbol(corked)]: 0,
//     [Symbol(kChunkedBuffer)]: [],
//     [Symbol(kChunkedLength)]: 0,
//     [Symbol(kSocket)]: TLSSocket {
//       _tlsOptions: [Object],
//       _secureEstablished: true,
//       _securePending: false,
//       _newSessionPending: false,
//       _controlReleased: true,
//       secureConnecting: false,
//       _SNICallback: null,
//       servername: 'graph.facebook.com',
//       alpnProtocol: false,
//       authorized: true,
//       authorizationError: null,
//       encrypted: true,
//       _events: [Object: null prototype],
//       _eventsCount: 9,
//       connecting: false,
//       _hadError: false,
//       _parent: null,
//       _host: 'graph.facebook.com',
//       _closeAfterHandlingError: false,
//       _readableState: [ReadableState],
//       _writableState: [WritableState],
//       allowHalfOpen: false,
//       _maxListeners: undefined,
//       _sockname: null,
//       _pendingData: null,
//       _pendingEncoding: '',
//       server: undefined,
//       _server: null,
//       ssl: [TLSWrap],
//       _requestCert: true,
//       _rejectUnauthorized: true,
//       timeout: 5000,
//       parser: null,
//       _httpMessage: null,
//       autoSelectFamilyAttemptedAddresses: [Array],
//       [Symbol(alpncallback)]: null,
//       [Symbol(res)]: [TLSWrap],
//       [Symbol(verified)]: true,
//       [Symbol(pendingSession)]: null,
//       [Symbol(async_id_symbol)]: -1,
//       [Symbol(kHandle)]: [TLSWrap],
//       [Symbol(lastWriteQueueSize)]: 0,
//       [Symbol(timeout)]: Timeout {
//         _idleTimeout: 5000,
//         _idlePrev: [TimersList],
//         _idleNext: [Timeout],
//         _idleStart: 18646,
//         _onTimeout: [Function: bound ],
//         _timerArgs: undefined,
//         _repeat: null,
//         _destroyed: false,
//         [Symbol(refed)]: false,
//         [Symbol(kHasPrimitive)]: false,
//         [Symbol(asyncId)]: 6142,
//         [Symbol(triggerId)]: 6140,
//         [Symbol(kAsyncContextFrame)]: undefined
//       },
//       [Symbol(kBuffer)]: null,
//       [Symbol(kBufferCb)]: null,
//       [Symbol(kBufferGen)]: null,
//       [Symbol(shapeMode)]: true,
//       [Symbol(kCapture)]: false,
//       [Symbol(kSetNoDelay)]: false,
//       [Symbol(kSetKeepAlive)]: true,
//       [Symbol(kSetKeepAliveInitialDelay)]: 1,
//       [Symbol(kBytesRead)]: 0,
//       [Symbol(kBytesWritten)]: 0,
//       [Symbol(connect-options)]: [Object]
//     },
//     [Symbol(kOutHeaders)]: [Object: null prototype] {
//       accept: [Array],
//       'content-type': [Array],
//       authorization: [Array],
//       'user-agent': [Array],
//       'content-length': [Array],
//       'accept-encoding': [Array],
//       host: [Array]
//     },
//     [Symbol(errored)]: null,
//     [Symbol(kHighWaterMark)]: 65536,
//     [Symbol(kRejectNonStandardBodyWrites)]: false,
//     [Symbol(kUniqueHeaders)]: null
//   },
//   response: {
//     status: 400,
//     statusText: 'Bad Request',
//     headers: Object [AxiosHeaders] {
//       'error-mid': '1b58965a90b35b0e1d734ce192a458f9',
//       vary: 'Origin, Accept-Encoding',
//       'access-control-allow-origin': '*',
//       'x-ad-api-version-warning': 'The call has been auto-upgraded to v22.0 as v20.0 will be deprecated.',
//       'cross-origin-resource-policy': 'cross-origin',
//       'x-app-usage': '{"call_count":0,"total_cputime":0,"total_time":0}',
//       'content-type': 'application/json',
//       'www-authenticate': `OAuth "Facebook Platform" "invalid_request" "Unsupported post request. Object with ID 'phone_number_id' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api"`,
//       'facebook-api-version': 'v22.0',
//       'strict-transport-security': 'max-age=15552000; preload',
//       pragma: 'no-cache',
//       'cache-control': 'no-store',
//       expires: 'Sat, 01 Jan 2000 00:00:00 GMT',
//       'x-fb-request-id': 'AUNjItV5mKwus4ptKiuwK-W',
//       'x-fb-trace-id': 'D64hg7IMM5E',
//       'x-fb-rev': '1021636778',
//       'x-fb-debug': 'cokYIXk5IABuvkCuamOqKqfLKbptqqhsVboA2+lZ8Ky8kbq+sv9yGSQ4u8e7Mz33RBNIeesOL6bpqS3xpsse3g==',
//       date: 'Mon, 07 Apr 2025 19:33:01 GMT',
//       'proxy-status': 'http_request_error; e_fb_responsebytes="AcKi-OQUnPgmiLtagwlpzstQkJnHOIFkzhox23nhhOhfi5EI80zr4NqfVXJX"; e_fb_requesttime="AcKDdQtFQOeveSAxWQVJsBDcy9CCWF6OnHMEgMRxZj3C981ezW2zjfIsu6iLU1hENE92-N0wMg"; e_proxy="AcK5X7LLwyxfGuwDNcqB9Ssl36uvJFiZ-vc4VCu81bMHlTTGTt0YcUJQWPb-wXA9dn0iHqmO8VfJcO8rHZ2F"; e_fb_twtaskhandle="AcIC56lGPxCYs-CIjOcdFvUGjTfpSzFGYUMKfPMciTS8ygBMzg7nrXWb18kCGcNx_OkHnWE5Sos9TmBWzlhbianIjIfKkI8W_aZRee_PyxBlAiU"; e_fb_requestsequencenumber="AcIVsf4LMBVRhgnHlqPxTMWU9GgtOjMi56Wa5Sa876fWhWDeLGDzzbnklICm"; e_upip="AcLOS5G4gHnp0-qm-LXdz2Qj7CG6L3V9uKZRvIT0TBCTgl_ulIlETLgoXAai2SNqc12Ktt1ruBBZPfCh1N1BJoLDEoF5tN1qfRH44w"; e_fb_zone="AcKVd8-uCOKup7KUtz9Ma-xmyU4IaClk0n4k0eF_bPYdbRs-qu0H7yrV5cru7pk8"; e_fb_binaryversion="AcIkxtYrR3U_gRBPwF_nFaCp6bU0UuwREijuq0rgsRoYCQ9mZBzdDwPtvTIrGMcFRe_TgNFWlI8f-fgKsuIBVLJ5pY9ujsDRI6o"; e_fb_httpversion="AcIh1wJgTnl-kR0XX0yxOH8LBf89I0K2_K3nZbNI3HxHcdjMV-dX43hZxXS6"; e_fb_requesthandler="AcIao9JNFaN5k14D_f33nrFuB46L1iley0n7-AsbKrkL0FSmpyOHAGU6maAMcguXzWO2H0SNkXE"; e_fb_configversion="AcJGG7s-PU7y2sAfzVo6MA00M8NH0Z3pck021mWCcPd0C7wSQsDz4M8ZRy9WAw"; e_fb_vipaddr="AcKtN8N60ZYrseUOMPNBdIQmKzMXFrIyTozW5uRwl_CDfKtsX4Oyh5cElBXgN_yMqXVCIW32ToZtqq20cmyRX4VFgdnWg_pStg"; e_fb_hostheader="AcLvlp0TN8TPI1H7I9lHmXf7xdj9oP0Gj762lXNXHn7WkNKTVTrctRf_EG8B4YJ9OYihhURN9159Nl5h"; e_fb_builduser="AcK3DCJiPIbGY_GIcbTwwlrgAUUeHgtanIPVFhJsPxD4Hy216yXczb-SMxIAF7GQfkE"; e_fb_vipport="AcLfCnxGezYrCTBMNytFkbikfwwKf0EqbOFELRE97wQRdmf_AZ_-T1h15Un0"; e_clientaddr="AcLGj_CxvdzKAX84jNZQ6ltxMqPElHjK-0w5WJt28taCgYH-ueXc6tA7Fu7RgFBfKZFqVeFtjdJ0Gpr7uKMIZIOb1ZV4M-OCnf5g5MBbhx5f9uuhWg", http_request_error; e_fb_responsebytes="AcIi3oG9LyfhcMB73JGMYQGqSicXuPYxaxgZJ2jJPqizWlIdUSwYhNSlfep_"; e_fb_requesttime="AcIwGla__r07pekGWPKBsI4y9rzFSLNmuH0EzAFutGn4PZClIKdZRHNbJRG1bC7CBPikArTJJA"; e_proxy="AcJo4gkYvHBPxBuE9IMTApfiXDcDOC9XbEgBf02zgnGAfPxAZs7YWF_X4ksjJOhof0xDqxI-oJKcfDs"; e_fb_twtaskhandle="AcIiPY5t62NqbIRP6fGcotXJ8LnyPp2wUd5GiHeKdCPC8NXHzFoMFRZs8gjjr5NkvHJjSDImkoxSND6ohybOl_kD2FNjLAKIap8T"; e_fb_requestsequencenumber="AcK32ea-15nPMWyEo0_e0jl8QZcDCMyBeGmMlx5J5EmngeukRpUqhWY-Jg"; e_upip="AcKwjfokJD__O4oFn5FIlU7xOlNaoTDKdJOPQB6kt6SC2kodRgvRF1fVNH26nLruVjDbDB9QEZjG_YsKykRY73AHtJShnidwhw"; e_fb_zone="AcLzk-Q0vqyC3RGs2bHKnLTEkBul8eVTIWY7j-bb1K_1IOsIWhbBdCtAeC3rXQ"; e_fb_binaryversion="AcL4ttQrsIxz_izMnkXagwojPnF5ZbD7pBq8FCiWh0wC3Y7uUwdqsJTzaconrUXC1tvL5G1mjE2fpJ69RxPdYN1CZvxBt_tpJ8M"; e_fb_httpversion="AcLfani4vFjsLbobosFkVnSflVO2id5_I42UigbXpGCga0kHpyBYTji8SJfu"; e_fb_requesthandler="AcJ-h1TxUTzYtxKR6tBTST0v-a6lVCQimkY5q8pDxt-HAiRpJerDITYZ0oKBcXbtclZZk-O8hCg"; e_fb_configversion="AcJNr5xEq7KlTBPjB7Jg_EXlsV1ZbAJVwlFJCyYVoj17LQ1G9THj0iEfj4otwg"; e_fb_vipaddr="AcJv3KLvPN1cRXJBVoQ2GN1WxTUFVpSWyb4U27NGX48x7DwolLYuVO-q7MsHsjVqSCv1ch0A3ro"; e_fb_hostheader="AcI15A3nWdejF9obrNhWIOK9j-G7Te3EXV8KJFagI4BFkT7VBwYkpOEeQoyeYdMWVNfRzyBHZOJQIecB"; e_fb_builduser="AcJlZeyd_KY0M2qLGm5R9YNQrM-H9pX71OVTjNlCNKyOGKQs9d2piq0PCH5Pa-l1syw"; e_fb_vipport="AcIszRHoKkR9R1W9506Yt8-K52dVWOLNEYeSeRfzj_Jvd-QhF8mFTxWiGB3A"; e_clientaddr="AcJUtB9QKfMB_RiAdZPzBwTZPRvZQ4NR8ACHmU980ISLWvvk4WckmGBzQvKVZv5iGIdWtYQosdGB67I"',
//       'x-fb-connection-quality': 'EXCELLENT; q=0.9, rtt=15, rtx=0, c=10, mss=1380, tbw=3405, tp=-1, tpl=-1, uplat=151, ullat=0',
//       'alt-svc': 'h3=":443"; ma=86400',
//       connection: 'keep-alive',
//       'content-length': '254'
//     },
//     config: {
//       transitional: [Object],
//       adapter: [Array],
//       transformRequest: [Array],
//       transformResponse: [Array],
//       timeout: 0,
//       xsrfCookieName: 'XSRF-TOKEN',
//       xsrfHeaderName: 'X-XSRF-TOKEN',
//       maxContentLength: -1,
//       maxBodyLength: -1,
//       env: [Object],
//       validateStatus: [Function: validateStatus],
//       headers: [Object [AxiosHeaders]],
//       method: 'post',
//       url: 'https://graph.facebook.com/v20.0/phone_number_id/messages',
//       data: `{"messaging_product":"whatsapp","recipient_type":"individual","to":"919490123143","type":"text","text":{"body":"Hi Viz! I'm doing well, thanks for asking. How about you?"}}`,
//       allowAbsoluteUrls: true
//     },
//     request: <ref *1> ClientRequest {
//       _events: [Object: null prototype],
//       _eventsCount: 7,
//       _maxListeners: undefined,
//       outputData: [],
//       outputSize: 0,
//       writable: true,
//       destroyed: true,
//       _last: false,
//       chunkedEncoding: false,
//       shouldKeepAlive: true,
//       maxRequestsOnConnectionReached: false,
//       _defaultKeepAlive: true,
//       useChunkedEncodingByDefault: true,
//       sendDate: false,
//       _removedConnection: false,
//       _removedContLen: false,
//       _removedTE: false,
//       strictContentLength: false,
//       _contentLength: '172',
//       _hasBody: true,
//       _trailer: '',
//       finished: true,
//       _headerSent: true,
//       _closed: true,
//       _header: 'POST /v20.0/phone_number_id/messages HTTP/1.1\r\n' +
//         'Accept: application/json, text/plain, */*\r\n' +
//         'Content-Type: application/json\r\n' +
//         'Authorization: Bearer \r\n' +
//         'User-Agent: axios/1.8.3\r\n' +
//         'Content-Length: 172\r\n' +
//         'Accept-Encoding: gzip, compress, deflate, br\r\n' +
//         'Host: graph.facebook.com\r\n' +
//         'Connection: keep-alive\r\n' +
//         '\r\n',
//       _keepAliveTimeout: 0,
//       _onPendingData: [Function: nop],
//       agent: [Agent],
//       socketPath: undefined,
//       method: 'POST',
//       maxHeaderSize: undefined,
//       insecureHTTPParser: undefined,
//       joinDuplicateHeaders: undefined,
//       path: '/v20.0/phone_number_id/messages',
//       _ended: true,
//       res: [IncomingMessage],
//       aborted: false,
//       timeoutCb: null,
//       upgradeOrConnect: false,
//       parser: null,
//       maxHeadersCount: null,
//       reusedSocket: false,
//       host: 'graph.facebook.com',
//       protocol: 'https:',
//       _redirectable: [Writable],
//       [Symbol(shapeMode)]: false,
//       [Symbol(kCapture)]: false,
//       [Symbol(kBytesWritten)]: 0,
//       [Symbol(kNeedDrain)]: false,
//       [Symbol(corked)]: 0,
//       [Symbol(kChunkedBuffer)]: [],
//       [Symbol(kChunkedLength)]: 0,
//       [Symbol(kSocket)]: [TLSSocket],
//       [Symbol(kOutHeaders)]: [Object: null prototype],
//       [Symbol(errored)]: null,
//       [Symbol(kHighWaterMark)]: 65536,
//       [Symbol(kRejectNonStandardBodyWrites)]: false,
//       [Symbol(kUniqueHeaders)]: null
//     },
//     data: { error: [Object] }
//   },
//   status: 400
// }
