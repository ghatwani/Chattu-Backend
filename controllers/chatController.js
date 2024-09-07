import { ALERT, NEW_MESSAGE, NEW_MESSAGE_ALERT, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { TryCatch } from "../middleware/error.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import { deleteFilesfromCloudinary, emitEvent, uploadFIlesToCloudinary } from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";

const newGroupchat = TryCatch(async (req, res, next) => {
    const { name, members } = req.body;
    const allMembers = [...members, req.user]
    await Chat.create({
        name,
        groupChat: true,
        creator: req.user,
        members: allMembers
    })
    emitEvent(req, ALERT, allMembers, `welcome to ${name} group`)
    emitEvent(req, REFETCH_CHATS, members)

    return res.status(201).json({
        success: true,
        message: "group Created"
    })
})
const getMychat = TryCatch(async (req, res, next) => {
    const chats = await Chat.find({ members: req.user }).populate("members", "name avatar")
    //the above query will return an array of chtas and group chats where members will have only the id and to access both name and avatar of the members populate is used

    const transformedChats = chats.map(({ _id, name, members, groupChat }) => {

        const otherMember = getOtherMember(members, req.user)
        return {
            _id,
            groupChat,
            avatar: groupChat ? members.slice(0, 3).map(({ avatar }) => avatar.url) : [otherMember.avatar.url],
            name: groupChat ? name : otherMember.name,
            members: members.reduce((prev, curr) => {
                if (curr._id.toString() !== req.user.toString()) {
                    prev.push(curr._id)
                }
                return prev;
            }, []),
        };
    })
    return res.status(201).json({
        success: true,
        chats: transformedChats
    })
})

const getMyGroups = TryCatch(async (req, res, next) => {
    const chats = await Chat.find({
        members: req.user,
        groupChat: true,
        creator: req.user,
    }).populate("members", "name avatar");
    const groups = chats.map(({ members, _id, groupChat, name }) => ({
        _id,
        name,
        groupChat,
        avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
    }));
    return res.status(200).json({
        success: true,
        groups
    })
})
const addMembers = TryCatch(async (req, res, next) => {
    const { chatId, members } = req.body
    // console.log(chatId, members)
    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404))
    if (!chat.groupChat) return next(new ErrorHandler("This is not a group Chat", 404))
    if (chat.creator.toString() != req.user.toString()) return next(new ErrorHandler("You are not allowed to add members", 403))

    const allNewMembersPromise = members.map((i) => User.findById(i, "name"))

    const allNewMembers = await Promise.all(allNewMembersPromise)

    const uniqueMembers = allNewMembers.filter((i) => !chat.members.includes(i._id.toString())).map((i) => i._id)
    chat.members.push(...uniqueMembers)

    if (chat.members.length > 100)
        return next(new ErrorHandler("Group members limit reached", 400))
    await chat.save()

    const allUserNames = allNewMembers.map((i) => i.name).join(",")
    emitEvent(
        req,
        ALERT,
        chat.members,
        `${allUserNames} has been added in the group`
    )
    emitEvent(req,
        REFETCH_CHATS,
        chat.members,
    )
    return res.status(200).json({
        success: true,
        message: "added successfully",
        chat
    })
})

const removeMember = TryCatch(async (req, res, next) => {
    const { userId, chatId } = req.body
    const [chat, userThatWillBeRemoved] = await Promise.all([
        Chat.findById(chatId),
        User.findById(userId, "name")
    ])

    if (!chat) return next(new ErrorHandler("Chat not found", 404))
    if (!chat.groupChat) return next(new ErrorHandler("This is not a group Chat", 404))
    if (chat.creator.toString() !== req.user.toString()) return next(new ErrorHandler("You are not allowed to remove members", 403))

    if (chat.members.length <= 3)
        return next(new ErrorHandler("Group must have atleast 3 members", 400));
    const allChatMembers=chat.members.map((i)=>i.toString());
    chat.members = chat.members.filter((member) => member.toString() !== userId.toString())
    await chat.save()
    emitEvent(
        req,
        ALERT,
        chat.members,
        {message:`${userThatWillBeRemoved.name} has been removed from the group`, chatId}
    )
    emitEvent(
        req,
        REFETCH_CHATS,
        allChatMembers
    )
    res.status(200).json({
        success: true,
        message: "Member removed successfully"
    })
})

const leaveGroup = TryCatch(async (req, res, next) => {
    const chatId = req.params.id
    const chat = await Chat.findById(chatId)
    const remainingMembers = chat.members.filter((member) => member.toString() !== req.user.toString());
    if (remainingMembers.length < 3) {
        return next(new ErrorHandler("Group must have atleast 3 members", 400))
    }
    if (chat.creator.toString() === req.user.toString()) {

        const randomElement = Math.floor(Math.random() * remainingMembers.length)
        const newCreator = remainingMembers[randomElement]
        chat.creator = newCreator
    }
    chat.members = remainingMembers;

    const [user] = await Promise.all([User.findById(req.user, "name"), chat.save()])

    emitEvent(
        req,
        ALERT,
        chat.members,
        {message:`User ${user.name} has left the group`, chatId}
    )

    return res.status(200).json({
        success: true,
        message: "Left group successfully"
    })

})
const sendAttachments = TryCatch(async (req, res, next) => {

    const { chatId } = req.body;

    const files = req.files || []

    if (files.length < 1) return next(new ErrorHandler("Please provide attachment", 400))
    if (files.length > 5) return next(new ErrorHandler("cannot send more than 5 files", 400))

    const [chat, me] = await Promise.all([Chat.findById(chatId), User.findById(req.user, "name")]);

    if (!chat) return next(new ErrorHandler("Chat not found", 404))


    if (files.length < 1) return next(new ErrorHandler("Please provide attachment", 400))

    //for uploading files here
    const attachments = await uploadFIlesToCloudinary(files)
    
    const messageForDB = { content: "", attachments, sender: me._id, chat: chatId }
    const messageForRealTime = {
        ...messageForDB,
        sender: {
            _id: me._id,
            name: me.name
        }
    }

    const message = await Message.create(messageForDB)

    emitEvent(req, NEW_MESSAGE, chat.members, {
        message: messageForRealTime,
        chatId
    })
    emitEvent(req, NEW_MESSAGE_ALERT, chat.members, {
        chatId
    })

    return res.status(200).json({
        success: true,
        message
    })
})

const getChatDetails = TryCatch(async (req, res, next) => {

    if (req.query.populate === "true")
    //this shows that you need to populate members name and avatar when it is passed in the url as a parameter
    {
        const chat = await Chat.findById(req.params.id)
            .populate("members", "name avatar")
            .lean()//lean is a classic javascript object so the changes made in the object will not be reflected in the main database
        if (!chat) return next(new ErrorHandler("Chat not found", 404))
        chat.members = chat.members.map(({ _id, name, avatar }) => ({
            _id,
            name,
            avatar: avatar.url,
        }))
        return res.status(200).json({
            success: true,
            chat,
        })
    }
    else {
        const chat = await Chat.findById(req.params.id)
        if (!chat) return next(new ErrorHandler("chat not found", 404))
        return res.status(200).json({
            sucess: true,
            chat
        })
    }
})

const renameGroup = TryCatch(async (req, res, next) => {
    const chatId = req.params.id;
    const { name } = req.body;

    const chat = await Chat.findById(chatId)
    if (!chat) return next(new ErrorHandler("chat not found", 404))

    if (!chat.groupChat) return next(new ErrorHandler("chat not found", 404))

    if (chat.creator.toString() !== req.user.toString())
        return next(new ErrorHandler("You are not allowed to rename the group", 403))

    chat.name = name;
    await chat.save()

    emitEvent(req, REFETCH_CHATS, chat.members)
    res.status(200).json({
        sucess: true,
        message: "group remaned successfully"
    })
})

const deleteChat = TryCatch(async (req, res, next) => {
    const chatId = req.params.id;
    
    const chat = await Chat.findById(chatId)

    if (!chat) return next(new ErrorHandler("chat not found", 404))
    console.log(chat)

    const members= chat.members;

    if (chat.groupChat && chat.creator.toString() !== req.user.toString()) return next(new ErrorHandler("Only Admin can delete the chats", 400))

    if (!chat.groupChat && !chat.members.includes(req.user.toString())) return next(new ErrorHandler("You are not allowed to delete the chat", 403))

    //we are going to delete all the chats and attachments from cloudinary
    const messagesWithAttachments = await Message.find({
        chat: chatId,
        attachemnts: { $exists: true, $ne: [] },
    })

    const public_ids = []

    messagesWithAttachments.forEach(({ attachment }) => {
        attachment.forEach(({ public_id }) => {
            public_ids.push(public_id)
        })
    })
    await Promise.all([
        deleteFilesfromCloudinary(public_ids),
        chat.deleteOne(),
        Message.deleteMany({ chat: chatId })
    ])
    emitEvent(req, REFETCH_CHATS, members)

    return res.status(200).json({
        success: true,
        message: "Chat deleted successfully"
    })
})

const getMessage = TryCatch(async (req, res, next) => {
    const chatId = req.params.id
    const { page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit

    const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.members.includes(req.user.toString()))
    return next(
      new ErrorHandler("You are not allowed to access this chat", 403)
    );

    const [messages, totalMessageCount] = await Promise.all([
        Message.find({ chat: chatId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sender", "name")
            .lean(),
        Message.countDocuments({ chat: chatId })
    ])
    const totalPages = Math.ceil(totalMessageCount / limit) || 0

    return res.status(200).json({
        success: "true",
        messages: messages.reverse(),
        totalPages
    })
})


export { addMembers, deleteChat, getChatDetails, getMessage, getMychat, getMyGroups, leaveGroup, newGroupchat, removeMember, renameGroup, sendAttachments };
