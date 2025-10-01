import io from 'socket.io-client';

const SERVER_A_URL = 'wss://socketio.avakado.ai';
const ORGANIZATION_ID = '67d438f6043626c8a6e381db';
const ADMIN_ID = 'test-sender-admin-id';

const adminSocket = io(`${SERVER_A_URL}/admin`, {
    query: {
        adminId: ADMIN_ID,
        organizationId: ORGANIZATION_ID
    },
    transports: ['websocket', 'polling'],
    reconnection: true
});

adminSocket.on('connect', () => {
    console.log('✅ Connected to admin namespace:', adminSocket.id);
    console.log('📤 Sending message to organization room...');
    sendToOrganizationRoom(myJsonData);
});

// IMPORTANT: Listen for 'trigger' event, not 'broadcastResult'
adminSocket.on('trigger', (response) => {
    console.log('📨 Received trigger event:', response);

    if (response.action === 'broadcastSent') {
        console.log('✅ Broadcast confirmed:', response.data);
        // Message was successfully sent
    } else if (response.action === 'activeUsers') {
        console.log('👥 Active users update:', response.data);
    }
});

// Also listen for the actual broadcast messages
adminSocket.on('broadcast', (message) => {
    console.log('📢 Received broadcast message:', message);
});

adminSocket.on('error', (error) => {
    console.error('❌ Socket error:', error);
});

adminSocket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
});

function sendToOrganizationRoom(jsonData) {
    adminSocket.emit('trigger', {
        action: 'broadcastToRoom',
        data: {
            roomId: ORGANIZATION_ID,
            message: jsonData,
            namespace: 'admin'  // Since you're broadcasting to admin namespace
        }
    });
}

const myJsonData = {
    type: 'notification',
    title: 'New Update',
    content: 'This is a message to all users in the organization',
    timestamp: new Date().toISOString(),
    priority: 'high'
};

// Keep process running to see responses
console.log('🔄 Starting socket client...');

// Exit after 10 seconds if no response
setTimeout(() => {
    console.log('⏱️ Timeout - exiting');
    adminSocket.disconnect();
    process.exit(0);
}, 10000);