import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

let io;

export async function initializeSocket(server) {
    // Setup Redis
    const pubClient = createClient({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
    });

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

