/**
 * Comprehensive Stream Event Handler
 * 
 * This handler processes all types of streaming events from an AI agent response,
 * including model responses, tool calls, and various state changes.
 */

export class StreamEventHandler {
    constructor() {
        this.lastDelta = ''
        this.currentResponse = null;
        this.toolCalls = new Map();
        this.messages = new Map();
        // this.accumulatedText = '';
        this.isComplete = false;
        this.processedEvents = new Set(); // Track processed event IDs to avoid duplicates
        this.lastSequenceNumber = -1; // Track sequence numbers
    }

    /**
     * Main handler that processes each streaming event
     * @param {Object} event - The streaming event object
     * @returns {Object} - Processed event information
     */
    handleEvent(event) {
        try {
            // Handle final completion signal
            if (event.done === true) {
                return this.handleCompletion();
            }

            const eventType = this.getEventType(event);

            // Skip duplicate events
            if (eventType === 'skip') {
                return null;
            }
            switch (eventType) {
                case 'response_started':
                    return this.handleResponseStarted(event);

                case 'response_created':
                    return this.handleResponseCreated(event);

                case 'function_call':
                    return this.handleFunctionCall(event);

                case 'function_call_output':
                    return this.handleFunctionCallOutput(event);

                case 'text_delta':
                    return this.handleTextDelta(event);

                case 'text_done':
                    return this.handleTextDone(event);

                case 'message_output':
                    return this.handleMessageOutput(event);

                case 'response_done':
                    return this.handleResponseDone(event);
                case 'tool_approval_requested':
                    return this.handleToolApprovalRequest(event);
                case 'unknown':
                    // Skip unknown events silently to reduce noise
                    return null;

                default:
                    return this.handleUnknown(event);
            }
        } catch (error) {
            return this.handleError(error, event);
        }
    }

    /**
     * Determines the type of event based on its structure
     */
    getEventType(event) {
        // Check for completion signal
        if (event.done === true) return 'completion';
        // Check data structure patterns - prioritize specific events first
        if (event.data?.type === 'response_started') return 'response_started';
        if (event.data?.type === 'response_done') return 'response_done'; // usage is at event.data?.response?.usage => : {     "input_tokens": 39,     "input_tokens_details": {         "cached_tokens": 0     },     "output_tokens": 434,     "output_tokens_details": {         "reasoning_tokens": 0     },     "total_tokens": 473 },
        if (event.data?.type === 'output_text_delta') return 'text_delta';
        // Check for tool-related events (these should be processed first)
        if (event.name === 'tool_called') return 'function_call';
        if (event.name === 'tool_output') return 'function_call_output';
        if (event.name === 'message_output_created') return 'message_output';
        // Check for model events - avoid duplicates by being more specific
        if (event.data?.event?.type === 'response.created' && event.data?.event?.sequence_number === 0) return 'response_created';
        if (event.data?.event?.type === 'response.output_text.delta') return 'text_delta';
        if (event.data?.event?.type === 'response.output_text.done') return 'text_done';
        if (event.data?.event?.type === 'response.completed' && event.type === 'raw_model_stream_event') return 'response_done'; // usage is at event.data?.event?.response?.usage => : {     "input_tokens": 39,     "input_tokens_details": {         "cached_tokens": 0     },     "output_tokens": 434,     "output_tokens_details": {         "reasoning_tokens": 0     },     "total_tokens": 473 },
        // Check for function call in model output - avoid duplicates
        if (event.data?.event?.item?.type === 'function_call' && event.data?.event?.type === 'response.output_item.done') return 'function_call';
        // Skip duplicate events
        if (event.data?.event?.type === 'response.completed' && event.data?.providerData) return 'skip';
        if (event.data?.event?.type === 'response.created' && event.data?.event?.sequence_number > 0) return 'skip';
        // human in the loop
        if (event.name === 'tool_approval_requested') return 'tool_approval_requested';
        return 'unknown';
    }

    /**
     * Handle response initialization
     */
    handleResponseStarted(event) {
        this.currentResponse = {
            id: event.data?.providerData?.response?.id,
            status: 'starting',
            model: event.data?.providerData?.response?.model,
            timestamp: new Date().toISOString()
        };

        return {
            type: 'response_started',
            response: this.currentResponse,
            message: 'AI response initiated'
        };
    }

    /**
     * Handle response creation confirmation
     */
    handleResponseCreated(event) {
        const response = event.data?.event?.response || event.data?.providerData?.response;

        if (response) {
            this.currentResponse = {
                ...this.currentResponse,
                id: response.id,
                model: response.model,
                status: response.status,
                tools: response.tools?.map(tool => ({
                    name: tool.name,
                    description: tool.description
                })) || []
            };
        }

        return {
            type: 'response_created',
            response: this.currentResponse,
            message: 'Response session established'
        };
    }

    /**
     * Handle function/tool calls
     */
    handleFunctionCall(event) {
        let functionCall;
        let eventId;

        // Extract function call from different event structures
        if (event.item?.rawItem) {
            functionCall = event.item.rawItem;
            eventId = functionCall.id || functionCall.callId;
        } else if (event.data?.event?.item) {
            functionCall = event.data.event.item;
            eventId = functionCall.id || functionCall.call_id;
        }

        // Avoid duplicate function calls
        if (eventId && this.processedEvents.has(`func_${eventId}`)) {
            return null;
        }

        if (functionCall && eventId) {
            this.processedEvents.add(`func_${eventId}`);

            const callInfo = {
                id: eventId,
                name: functionCall.name,
                arguments: this.parseArguments(functionCall.arguments),
                status: functionCall.status,
                timestamp: new Date().toISOString()
            };

            this.toolCalls.set(callInfo.id, callInfo);

            return {
                type: 'function_call',
                functionCall: callInfo,
                message: `Tool called: ${callInfo.name}`
            };
        }

        return null;
    }

    /**
     * Handle function call outputs/results
     */
    handleFunctionCallOutput(event) {
        const output = event.item?.rawItem || event.item;

        if (output) {
            const callId = output.callId;
            const result = {
                callId: callId,
                output: output.output?.text || output.output,
                status: output.status,
                timestamp: new Date().toISOString()
            };

            // Update the corresponding tool call
            if (this.toolCalls.has(callId)) {
                this.toolCalls.get(callId).result = result;
            }

            return {
                type: 'function_output',
                result: result,
                message: `Tool output received for: ${callId}`
            };
        }

        return { type: 'function_output', error: 'Could not parse function output' };
    }
    handleToolApprovalRequest(event) {
        console.log("tool_approval_requested");
        return event
    }
    /**
     * Handle streaming text deltas (incremental text updates)
     */
    handleTextDelta(event) {
        let delta = '';

        if (event.data?.delta) delta = event.data.delta;
        else if (event.data?.event?.delta) delta = event.data.event.delta;

        // Deduplicate delta content
        if (delta && delta === this.lastDelta) return null; // skip duplicate

        this.lastDelta = delta;
        // this.accumulatedText += delta;

        return {
            type: 'text_delta',
            delta: delta,
            // accumulatedText: this.accumulatedText,
            message: 'Text streaming'
        };
    }

    /**
     * Handle completed text output
     */
    handleTextDone(event) {
        const text = event.data?.event?.text;

        return {
            type: 'text_done',
            finalText: text,
            message: 'Text generation completed'
        };
    }

    /**
     * Handle message output creation
     */
    handleMessageOutput(event) {
        const messageItem = event.item?.rawItem;

        if (messageItem) {
            const message = {
                id: messageItem.id,
                role: messageItem.role,
                content: messageItem.content,
                status: messageItem.status,
                timestamp: new Date().toISOString()
            };

            this.messages.set(message.id, message);

            return {
                type: 'message_output',
                message: message,
                message: 'Message output created'
            };
        }

        return { type: 'message_output', error: 'Could not parse message output' };
    }

    /**
     * Handle response completion
     */
    handleResponseDone(event) {
        const response = event.data?.response || event.data?.event?.response;
        const sequenceNumber = event.data?.event?.sequence_number;

        // Avoid duplicate response_done events
        if (sequenceNumber && this.processedEvents.has(`response_done_${sequenceNumber}`)) {
            return null;
        }

        if (response && sequenceNumber) {
            this.processedEvents.add(`response_done_${sequenceNumber}`);

            this.currentResponse = {
                ...this.currentResponse,
                status: 'completed',
                usage: response.usage,
                finalOutput: response.output,
                completedAt: new Date().toISOString()
            };

            return {
                type: 'response_done',
                response: this.currentResponse,
                toolCalls: Array.from(this.toolCalls.values()),
                messages: Array.from(this.messages.values()),
                message: 'Response completed successfully'
            };
        }

        return null;
    }

    /**
     * Handle final completion signal
     */
    handleCompletion() {
        this.isComplete = true;

        return {
            type: 'stream_complete',
            summary: {
                response: this.currentResponse,
                toolCalls: Array.from(this.toolCalls.values()),
                messages: Array.from(this.messages.values()),
                // finalText: this.accumulatedText,
                isComplete: true
            },
            message: 'Stream completed'
        };
    }

    /**
     * Handle unknown event types
     */
    handleUnknown(event) {
        return {
            type: 'unknown',
            rawEvent: event,
            message: 'Unknown event type received'
        };
    }

    /**
     * Handle errors during processing
     */
    handleError(error, event) {
        return {
            type: 'error',
            error: error.message,
            rawEvent: event,
            message: 'Error processing stream event'
        };
    }

    /**
     * Utility to safely parse JSON arguments
     */
    parseArguments(args) {
        if (typeof args === 'string') {
            try {
                return JSON.parse(args);
            } catch {
                return args;
            }
        }
        return args;
    }

    /**
     * Get current state summary
     */
    getState() {
        return {
            response: this.currentResponse,
            toolCalls: Array.from(this.toolCalls.values()),
            messages: Array.from(this.messages.values()),
            // accumulatedText: this.accumulatedText,
            isComplete: this.isComplete
        };
    }

    /**
     * Reset handler state for new stream
     */
    reset() {
        this.lastDelta = ''
        this.currentResponse = null;
        this.toolCalls.clear();
        this.messages.clear();
        // this.accumulatedText = '';
        this.isComplete = false;
        this.processedEvents.clear();
        this.lastSequenceNumber = -1;
    }
}

