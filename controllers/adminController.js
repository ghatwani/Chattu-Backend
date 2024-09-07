import { TryCatch } from "../middleware/error.js";
import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { ErrorHandler } from "../utils/utility.js";
import jwt from "jsonwebtoken";
import { cookieOptions } from "../utils/features.js";
import { adminSecretKey } from "../app.js";

const adminLogin = TryCatch(async (req, res, next) => {
    const { secretKey } = req.body;
    // console.log("1secretKey", secretKey)
    const isMatch = secretKey === adminSecretKey
    // console.log(isMatch)
    if (!isMatch) return next(new ErrorHandler("Invalid admin key", 401))

    const token = jwt.sign(secretKey, process.env.JWT_SECRET)
    // console.log(token)
    return res
        .status(200)
        .cookie("chattu-admin-token", token, { ...cookieOptions, maxAge: 1000 * 60 * 15 })
        .json({
            success: true,
            message: "Logged in successfully",
        })
})
const adminLogout = TryCatch(async (req, res) => {
    // const token = jwt.sign(secretKey,process.env.JWT_SECRET)

    return res.status(200)
        .cookie("chattu-admin-token", "", { ...cookieOptions, maxAge: 0 })
        .json({
            success: true,
            message: "Logged out successfully",
        })
})
const allUsers = TryCatch(async (req, res, next) => {
    const users = await User.find({});

    const transformedUsers = await Promise.all(
        users.map(
            async ({ name, username, avatar, _id }) => {
                const [groups, friends] = await Promise.all([Chat.countDocuments({ groupChat: true, members: _id }),
                Chat.countDocuments({ groupChat: false, members: _id })
                ])
                return {
                    name,
                    username,
                    avatar: avatar.url,
                    _id,
                    groups,
                    friends
                }
            }
        )
    )
    return res.status(200).json({
        success: true,
        users: transformedUsers,
    })
})

const allChats = TryCatch(async (req, res, next) => {
    const chats = await Chat.find({}).populate("members", "name avatar").populate("creator", "name avatar")

    const transformchats = await Promise.all(
        chats.map(async ({ _id, name, groupChat, creator, members }) => {
            const totalMessages = await Message.countDocuments({ chat: _id })
            return {
                _id,
                name,
                groupChat,
                avatar: members.slice(0, 3).map((member) => member.avatar.url),
                members: members.map(({ _id, name, avatar }) => {
                    return {
                        _id,
                        name,
                        avatar: avatar.url
                    }
                }), creator: {
                    name: creator?.name || "None",
                    avatar: creator?.avatar.url || "None"
                },
                totalMembers: members.length,
                totalMessages
            }
        })
    )
    return res.status(200).json({
        success: "true",
        chats: transformchats
    })
})

const allMessages = TryCatch(async (req, res) => {
    const messages = await Message.find({})
        .populate("sender", "name avatar")
        .populate("chat", "groupChat");

    const transformedMessages = messages.map(({ content, attachments, _id, sender, createdAt, chat, name }) => ({
        _id,
        name,
        createdAt,
        content,
        attachments,
        chat: chat._id,
        groupChat: chat.groupChat,
        sender: {
            _id: sender._id,
            name: sender.name,
            avatar: sender.avatar.url
        }
    }))
    return res.status(200).json({
        success: true,
        messages: transformedMessages
    })
})
const getDashboardStats = TryCatch(async (req, res) => {

    const [groupsCount, usersCount, messageCount, totalChatCount] = await Promise.all([
        Chat.countDocuments({ groupChat: true }),
        User.countDocuments(),
        Message.countDocuments(),
        Chat.countDocuments(),
    ])

    const today = new Date()
    const last7Days = new Date()
    last7Days.setDate(last7Days.getDate() - 7)

    const last7DaysMessages = await Message.find({
        createdAt: {
            $gte: last7Days,
            $lte: today,
        },
    }).select("createdAt")

// console.log("last7DaysMessages", last7DaysMessages)
    const messages = new Array(7).fill(0)

    const daysinMiliseconds = 1000 * 60 * 60 * 24
    last7DaysMessages.forEach((message) => {
        const indexApprox = (today.getTime() - message.createdAt.getTime()) / daysinMiliseconds
        const index = Math.floor(indexApprox)
        messages[6 - index]++;
    })
    const stats = {
        groupsCount, usersCount, messageCount, totalChatCount, messagesChart: messages,
    }
// console.log(stats)
    return res.status(200).json({
        success: true,
        stats
    })
})
const getAdminData = TryCatch(async (req, res) => {
    return res.status(200).json({
        admin: true
    })
})
export { allUsers, allChats, allMessages, getDashboardStats, adminLogin, adminLogout, getAdminData }