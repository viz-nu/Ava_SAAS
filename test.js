
// Test 3: Invalid email format
const test3_book_deal = {
    "userMessage": "I'm from Apple, email is invalid-email, time is 2024-06-08T16:00:00Z",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "Need to discuss a potential deal"
            }]
        }
    ]
};

// Test 4: Invalid date format
const test4_book_deal = {
    "userMessage": "Google Inc, contact@google.com, and let's meet tomorrow afternoon",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "Want to explore business opportunities"
            }]
        }
    ]
};

// Test 5: Conversation flow - gradual information gathering
const test5_book_deal = {
    "userMessage": "Sure, I'm from Tesla and here's my email: elon@tesla.com",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "Hey, I'm impressed with your vision, wanna connect with your sales team"
            }]
        },
        {
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": "Thank you! I'd be happy to help you connect with our sales team. Could you please provide me with your preferred time for the meeting and your contact email?"
            }]
        },
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I would prefer 8pm tonight"
            }]
        },
        {
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": "Could you please provide me with your contact email and company name so I can arrange the meeting with the sales team for 8pm tonight?"
            }]
        }
    ]
};

// ===== SCHEDULE_EXPERT_MEETING TESTS =====

// Test 6: Successful expert meeting booking
const test6_expert = {
    "userMessage": "I need to speak with a financial advisor next Tuesday at 10 AM. My email is investor@startup.com",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I need help with financial planning for my startup"
            }]
        },
        {
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": "I can help you schedule a meeting with one of our financial advisors. What's your preferred time and email address?"
            }]
        }
    ]
};

// Test 7: Unsupported expert type
const test7_expert = {
    "userMessage": "I want to meet with a legal expert tomorrow at 3pm, email: legal@company.com",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I have some legal questions about contracts"
            }]
        }
    ]
};

// Test 8: Missing email
const test8_expert = {
    "userMessage": "I need a product specialist for next Friday morning",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "Can you help me understand your product features better?"
            }]
        }
    ]
};

// Test 9: Invalid email for expert meeting
const test9_expert = {
    "userMessage": "Technical consultant, next week, bad-email-format",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I need technical guidance on implementation"
            }]
        }
    ]
};

// ===== FETCH_KNOWLEDGE TESTS =====

// Test 10: Successful knowledge fetch
const test10_knowledge = {
    "userMessage": "Can you look up pricing information from the product_manual?",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I need to understand your pricing structure"
            }]
        },
        {
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": "I can help you find pricing information. Let me search our knowledge base for you."
            }]
        }
    ]
};

// Test 11: Invalid source
const test11_knowledge = {
    "userMessage": "Search for 'API documentation' in the 'random_source' database",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "Where can I find API documentation?"
            }]
        }
    ]
};

// Test 12: Query too short
const test12_knowledge = {
    "userMessage": "Find 'hi' in company_docs",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I need some quick info"
            }]
        }
    ]
};

// Test 13: Missing parameters
const test13_knowledge = {
    "userMessage": "I need information but didn't specify what or where to look",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "Can you help me find something?"
            }]
        }
    ]
};

// Test 14: Complex knowledge query
const test14_knowledge = {
    "userMessage": "Please search for 'integration workflows and API rate limits' in the company_docs source",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I'm implementing your API and need detailed integration guidance"
            }]
        },
        {
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": "I can help you with API integration details. What specific information are you looking for?"
            }]
        }
    ]
};

// ===== EDGE CASE TESTS =====

// Test 15: Multiple tool requirements in one message
const test15_multi = {
    "userMessage": "I'm from Netflix (netflix@company.com), want to book sales meeting for 2024-06-08T14:00:00Z, also need technical consultant for next week (tech@netflix.com), and please search for 'partnership guidelines' in policy_guide",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "We're exploring a comprehensive partnership"
            }]
        }
    ]
};

// Test 16: Ambiguous request
const test16_ambiguous = {
    "userMessage": "I want to schedule something for tomorrow",
    "prevMessages": [
        {
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "I need help with scheduling"
            }]
        }
    ]
};

// Export all tests for easy usage
const allTests = {
    book_deal_slot: [test1_book_deal, test2_book_deal, test3_book_deal, test4_book_deal, test5_book_deal],
    schedule_expert_meeting: [test6_expert, test7_expert, test8_expert, test9_expert],
    fetch_knowledge: [test10_knowledge, test11_knowledge, test12_knowledge, test13_knowledge, test14_knowledge],
    edge_cases: [test15_multi, test16_ambiguous]
};

console.log('Tools and test scenarios ready for testing!');