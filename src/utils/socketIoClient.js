import io from 'socket.io-client';
const SERVER_A_URL = 'wss://socketio.avakado.ai';
export const sendMessageToRoom = (roomId, action, message, namespace) => {
    let socket;
    try {
        switch (namespace) {
            case 'admin':
                socket = io(SERVER_A_URL + '/admin');
                break;
            case 'user':
                socket = io(SERVER_A_URL + '/user');
                break;
        }
        if (socket) socket.emit('trigger', { action, data: { roomId, message, namespace } });
        socket.disconnect();
    } catch (error) {
        console.error('Error sending message to room:', error);
    }
}