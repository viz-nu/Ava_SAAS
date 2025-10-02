import io from 'socket.io-client';
const SERVER_A_URL = 'https://socketio.avakado.ai';
export const sendMessageToRoom = (roomId, action, message, namespace) => {
    let socket;
    try {
        switch (namespace) {
            case 'admin':
                socket = io(SERVER_A_URL + '/admin', { transports: ['websocket'] });
                break;
            case 'user':
                socket = io(SERVER_A_URL + '/user', { transports: ['websocket'] });
                break;
        }
        if (socket) socket.emit('trigger', { action, data: { roomId, message, namespace } });
        socket.disconnect();
    } catch (error) {
        console.error('Error sending message to room:', error);
    }
}