import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { Conversation } from "../models/Conversations.js";

let io;

export async function initializeSocket(server) {
    // Setup Redis
    const pubClient = createClient({ url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`, });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Initialize Socket.IO
    io = new Server(server, {
        transports: ['websocket'],
        cors: {
            origin: "*",
            credentials: true,
        },
    });
    // Create a separate namespace for admin-related events
    const adminNamespace = io.of('/admin');
    adminNamespace.on('connection', (socket) => {

        console.log('Admin connected:', socket.id);


        socket.on('join-admin', (adminId) => {
            console.log('Admin joined room:', adminId);
            socket.join(adminId);
        });

        socket.on('trigger', async (triggerObject) => {
            try {
                const { action, data } = triggerObject;
                console.log("Trigger action:", action, "with data:", data);
                switch (action) {
                    case 'getActiveUsersByAgent':
                        const { agentId } = data;
                        // get rooms for the agentId
                        socket.emit('activeUsers', { count: (await ChatNameSpace.in(agentId).fetchSockets()).length });
                        break;
                    // case 'message':
                    //     const { message, userId } = data;
                    //     console.log("Message received:", message);
                    //     if (userId) {
                    //         io.to(userId).emit('message', { message, from: socket.id });
                    //     }
                    //     break;
                    // case 'notification':
                    //     const { notification, recipientId } = data;
                    //     console.log("Notification sent to:", recipientId);
                    //     if (recipientId) {
                    //         io.to(recipientId).emit('notification', notification);
                    //     }
                    //     break;
                    default:
                        console.warn("Unknown action:", action);
                }
            }
            catch (error) {
                console.error("Error in trigger event:", error);
            }
        });
        socket.on('disconnect', () => {
            console.log('Admin disconnected:', socket.id);
        });
    });

    // Create a namespace for chat
    const ChatNameSpace = io.of('/chat');
    ChatNameSpace.on('connection', (socket) => {
        socket.on('join', async (triggerObject) => {
            const { conversationID, agentId } = triggerObject.data;
            console.log("User joined conversation:", conversationID);
            if (conversationID) {
                socket.join(conversationID);
                await Conversation.updateOne({ _id: conversationID }, { $set: { socketId: socket.id, status: "active" } });
            }
            if (agentId) {
                console.log("User joined agent room:", agentId);
                socket.join(agentId);
            }
        });
        socket.on('trigger', async (triggerObject) => {
            try {
                const { action, data } = triggerObject;
                console.log("Trigger action:", action, "with data:", data);
                switch (action) {
                    case 'getActiveUsersByAgent':
                        const { agentId } = data;
                        // get rooms for the agentId
                        const rooms = await ChatNameSpace.in(agentId).fetchSockets();

                        break;
                    // case 'message':
                    //     const { message, userId } = data;
                    //     console.log("Message received:", message);
                    //     if (userId) {
                    //         io.to(userId).emit('message', { message, from: socket.id });
                    //     }
                    //     break;
                    // case 'notification':
                    //     const { notification, recipientId } = data;
                    //     console.log("Notification sent to:", recipientId);
                    //     if (recipientId) {
                    //         io.to(recipientId).emit('notification', notification);
                    //     }
                    //     break;
                    default:
                        console.warn("Unknown action:", action);
                }
            }
            catch (error) {
                console.error("Error in trigger event:", error);
            }
        });

        socket.on('disconnect', async (reason) => {
            console.log("User disconnected:", socket.id, "reason:", reason);
            try {
                const conversation = await Conversation.findOne({ "sockets.socketId": socket.id });
                if (conversation) {
                    conversation.sockets.disconnectReason = reason;
                    conversation.status = "disconnected";
                    await conversation.updateAnalytics();
                    await conversation.save();
                }
            } catch (err) {
                console.error("Error during socket disconnect handling:", err);
            }
        });
    });

    // Use Redis adapter
    io.adapter(createAdapter(pubClient, subClient));

    // Socket events
    io.on('connection', (socket) => {

        const userId = socket.handshake.query.userId;
        console.log("user connected joining", userId);
        userId ? socket.join(userId) : null;

        socket.on('join', (triggerObject) => {
            const userId = triggerObject.data._id;
            console.log("User joined:", triggerObject.data.name);
            console.log(triggerObject);
            if (userId) socket.join(userId);
        });
        socket.on('disconnect', () => { console.log("User disconnected:", socket.id) });
    });
}
export { io };

// {
//     socketId: 'TZHDxLgrXERfhioeAAAB',
//         namespace: '/chat',
//             connected: true,
//                 ip: '::ffff:127.0.0.1',
//                     transport: 'websocket',
//                         handshakeTime: 'Sun Jul 27 2025 00:39:26 GMT+0530 (India Standard Time)',
//                             queryParams: [Object: null prototype] { EIO: '4', transport: 'websocket' },
//     authData: { },
//     headers: {
//         'sec-websocket-version': '13',
//             'sec-websocket-key': 'BxY8DAd6WNSd+4I5+95Kdg==',
//                 connection: 'Upgrade',
//                     upgrade: 'websocket',
//                         'sec-websocket-extensions': 'permessage-deflate; client_max_window_bits',
//                             host: 'localhost:3000'
//     },
//     userAgent: undefined,
//         referer: undefined,
//             rooms: ['TZHDxLgrXERfhioeAAAB']
// }
// console.log('user connected:', {
//     socketId: socket.id,
//     namespace: socket.nsp.name,
//     connected: socket.connected,
//     ip: socket.handshake.address || socket.conn.remoteAddress,
//     transport: socket.conn.transport.name,
//     handshakeTime: socket.handshake.time,
//     queryParams: socket.handshake.query,
//     authData: socket.handshake.auth,
//     headers: socket.handshake.headers,
//     userAgent: socket.handshake.headers['user-agent'],
//     referer: socket.handshake.headers['referer'],
//     rooms: [...socket.rooms], // Convert Set to array
// });