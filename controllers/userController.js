import { compare } from "bcrypt";
import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import { cookieOptions, emitEvent, sendToken, uploadFIlesToCloudinary } from "../utils/features.js";
import { TryCatch } from "../middleware/error.js";
import { ErrorHandler } from "../utils/utility.js";
import { Request } from "../models/request.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
//api for registering user and saving its info to database save in cookie
const newUser = TryCatch(
    async (req, res, next) => {
        const { name, username, password, bio } = req.body

        const file = req.file
        console.log(req.file)
        if (!file) return next(new ErrorHandler("Please Upload Avatar"))
        
        const result= await uploadFIlesToCloudinary([file])
            const avatar = {
            public_id: result[0].public_id,
            url: result[0].url
        }
        const user = await User.create({
            name,
            username,
            password,
            avatar,
            bio
        })
        sendToken(res, user, 201, "user Created")

        // res.status(201).json({message:"User created successfully"})
    }
)

const userLogin = TryCatch(async (req, res, next) => {
    const { username, password } = req.body;
    const user = await User.findOne({
        username
    }).select("+password") //this is used becuase in schema we selected password as false but now we need it to compare with password entered by the user
    console.log(1)
    if (!user) return next(new ErrorHandler("Invalid username", 404))
    const isMatch = await compare(password, user.password) //(decrypted paassword, encrypted password)
    console.log(2)
    if (!isMatch) return next(new ErrorHandler("Invalid password", 404))
    sendToken(res, user, 201, `Welcome Back! ${user.name}`)
})
const getMyProfile = TryCatch(async (req, res, next) => {

    const user = await User.findById(req.user)
    if (!user) return next(new ErrorHandler("user not found", 404))
    res.status(200).json({
        success: true,
        data: req.user,
        user
    })
})
const logout = TryCatch(async (req, res) => {
    return res.status(200).cookie("chattu-token", "", { ...cookieOptions, maxAge: 0 }).json({
        success: true,
        message: "Logged out successfully"
    })
})
const searchUser = TryCatch(async (req, res) => {

    const { name = "" } = req.query

    const myChats = await Chat.find({ groupChat: false, members: req.user })
    const allUsersFromMyChat = myChats.map((chat) => chat.members).flat()

    const allUsersExceptMeAndFriends = await User.find({
        _id: { $nin: allUsersFromMyChat },
        name: {
            $regex: name, $options: "i" //option : i means that it is case insensitive
        }
    })
    const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
        _id,
        name,
        avatar: avatar.url,
    }))
    return res.status(200).json({
        success: true,
        users
    })
})
const sendFriendRequest = TryCatch(async (req, res, next) => {
    const { userId } = req.body
    const request = await Request.findOne({
        $or: [
            { sender: req.user, receiver: userId },
            { sender: userId, receiver: req.user }
        ]
    })
    if (request) {
        return next(new ErrorHandler("request already sent", 400))
    }
    await Request.create({
        sender: req.user,
        receiver: userId
    })
    emitEvent(req, NEW_REQUEST, [userId])
    return res.status(200).json({
        success: true,
        message: "Friend Request Sent"
    })
})
const acceptFriendRequest = TryCatch(async (req, res, next) => {

    const { requestId, accept } = req.body

    const request = await Request.findById(requestId).populate("sender", "name").populate("receiver", "name")

    if (!request) return next(new ErrorHandler("Request not Found", 404))

    if (request.receiver._id.toString() !== req.user.toString())
        return next(new ErrorHandler("You are not authorised to accept this request", 401))

    if (!accept) {
        await request.deleteOne()
        return res.status(200).json({
            success: true,
            message: "Friend request Rejected"
        })
    }
    const members = [request.sender._id, request.receiver._id]
    await Promise.all([Chat.create({
        members,
        name: `${request.sender.name}-${request.receiver.name}`,

    }),
    request.deleteOne()
    ])
    emitEvent(req, REFETCH_CHATS, members);

    return res.status(200).json({
        success: true,
        message: "Friend request Accepted",
        senderId: request.sender._id
    })
})
const getMyNotifications = TryCatch(async (req, res) => {
    const requests = await Request.find({ receiver: req.user }).populate("sender", "name avatar")

    const allrequest = requests.map(({ _id, sender }) => ({
        _id,
        sender: {
            _id: sender._id,
            name: sender.name,
            avatar: sender.avatar.url
        }
    }))
    return res.status(200).json({
        success: true,
        allrequest
    })
})
const getMyFriends = TryCatch(async (req, res) => {
    const chatId = req.query.chatId

    const chats = await Chat.find({
        members: req.user,
        groupChat: false
    }).populate("members", "name avatar")

    const friends = chats.map(({ members }) => {
        const otherUser = getOtherMember(members, req.user)
        return {
            _id: otherUser._id,
            name: otherUser.name,
            avatar: otherUser.avatar.url
        }
    })
    if (chatId) {
        const chat = await Chat.findById(chatId);

        const availableFriends = friends.filter((friend) => !chat.members.includes(friend._id));
        return res.status(200).json({
            success: true,
            friends: availableFriends
        })
    }
    else {
        return res.status(200).json({
            success: true,
            friends
        })
    }
    
})

export { userLogin, newUser, getMyProfile, logout, searchUser, sendFriendRequest, acceptFriendRequest, getMyNotifications, getMyFriends }