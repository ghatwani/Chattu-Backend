import express from "express";
import { connectDB } from "./utils/features.js";
import dotenv from "dotenv";
import { errorMiddleware } from "./middleware/error.js";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { createServer } from "http";
import { v4 as uuid } from "uuid";
import cors from "cors";
import {v2 as cloudinary} from "cloudinary";



import { createGroupChats, createMessageInChat, createSingleChats, createUser } from "./seeders/user.js";
import { CHAT_JOINED, CHAT_LEFT, NEW_MESSAGE, NEW_MESSAGE_ALERT, ONLINE_USERS, START_TYPING, STOP_TYPING } from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/message.js";
import { corsOptions } from "./config/config.js";
import { socketAuthenticator } from "./middleware/auth.js";


import userRoute from "./routes/user.js";
import chatRoute from "./routes/chat.js";
import adminRoute from "./routes/admin.js";

dotenv.config({
    path: './.env'
})

const mongoURI = process.env.MONGO_URI;
const port = process.env.PORT || 3000
const envmode = process.env.NODE_ENV.trim() || "PRODUCTION"
const adminSecretKey = process.env.ADMIN_SECRET_KEY || "ajvcdhsafchgdsfdch"

const userSocketIDs = new Map();
const onlineUsers = new Set();

connectDB(mongoURI)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET
})

// createUser(10)
// createSingleChats(10)
// createGroupChats(10)
// createMessageInChat("668e60749522e3d7325bd7c8", 78)

const app = express();
const server = createServer(app)
const io = new Server(server, {
    cors:corsOptions,
})
app.set('io', io)

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
//we are going to have multipart form i.e. both file and text for that we are using multer and we can use the below one in case of textual data
// app.use(express.urlencoded())

app.use('/api/v1/user', userRoute)
app.use('/api/v1/chat', chatRoute)
app.use('/api/v1/admin', adminRoute)

app.get('/', async (req, res) => {
    res.send("Hello world")
})
io.use((socket, next) => {
    cookieParser()(socket.request, socket.request.res, async(err)=> await socketAuthenticator(err, socket, next)
    )
 })
io.on("connection", (socket) => {
    // console.log("a user connected", socket.id)
    const user = socket.user
    // console.log(user)
    userSocketIDs.set(user._id.toString(), socket.id)
    socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {

        const messageForRealTime = {
            content: message,
            _id: uuid(),
            sender: {
                _id: user._id,
                name: user.name
            },
            chat: chatId,
            createdAt: new Date().toISOString()
        }

        const messageForDB = {
            content: message,
            sender: user._id,
            chat: chatId,
        }

        // console.log("Emmitting", messageForRealTime)
        const membersSocket = getSockets(members);
        //listener for emit event
        io.to(membersSocket).emit(NEW_MESSAGE, {
            chatId,
            message: messageForRealTime
        })
        io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId })
        try {
            await Message.create(messageForDB)
        } catch (error) {
            throw new Error(error)
        }
    })
    socket.on(START_TYPING, ({members, chatId})=>{
        const membersSocket=getSockets(members)
        // console.log("typing", members, chatId)
        socket.to(membersSocket).emit(START_TYPING, {chatId})
    })
    socket.on(STOP_TYPING, ({members, chatId})=>{
        const membersSocket=getSockets(members)
        // console.log("stop typing", members, chatId)
        socket.to(membersSocket).emit(STOP_TYPING, {chatId})
    })
    socket.on(CHAT_JOINED, ({userId, members})=>{
        onlineUsers.add(userId.toString())
        const memberSockets=getSockets(members)
        io.to(memberSockets).emit(ONLINE_USERS, Array.from(onlineUsers))
    })
    socket.on(CHAT_LEFT, ({userId, members})=>{
        onlineUsers.delete(userId.toString())
        const memberSockets=getSockets(members)
        io.to(memberSockets).emit(ONLINE_USERS, Array.from(onlineUsers))
    })
    socket.on("disconnect", () => {
        // console.log("User disconnected")
        userSocketIDs.delete(user._id.toString())
        onlineUsers.delete(user._id.toString())
        socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers))
    })
})

app.use(errorMiddleware)
server.listen(port, () => {
    console.log(`Server is running on port ${port} in ${envmode} Mode`)
});


export { envmode, adminSecretKey, userSocketIDs }
