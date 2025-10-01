import io from 'socket.io-client';

const SERVER_A_URL = 'wss://socketio.avakado.ai';
const ORGANIZATION_ID = '67d438f6043626c8a6e381db';
const ADMIN_ID = 'test-receiver-admin';  // Different admin ID

const receiverSocket = io(`${SERVER_A_URL}/admin`, {
    query: {
        adminId: ADMIN_ID,
        organizationId: ORGANIZATION_ID  // Same org ID to receive broadcasts
    },
    transports: ['websocket']
});

receiverSocket.on('connect', () => {
    console.log('🎧 Receiver connected:', receiverSocket.id);
    console.log('🔔 Listening for broadcasts in organization:', ORGANIZATION_ID);
});

// Listen for broadcast messages
receiverSocket.on('broadcast', (message) => {
    console.log('\n📩 ===== BROADCAST RECEIVED =====');
    console.log(JSON.stringify(message, null, 2));
    console.log('================================\n');
});

// Also listen for trigger events
receiverSocket.on('trigger', (response) => {
    console.log('📨 Trigger event:', response);
});

receiverSocket.on('error', (error) => {
    console.error('❌ Error:', error);
});

receiverSocket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
});

console.log('🎧 Receiver client starting...');