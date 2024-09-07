import express from "express";
import { addMembers, deleteChat, getChatDetails, getMessage, getMychat, getMyGroups, leaveGroup, newGroupchat, removeMember, renameGroup, sendAttachments } from "../controllers/chatController.js";
import { addMemberValditor, chatIdValidator, newGroupChatValidator, removeMemberValditor, sendAttachmentValidator, validateHandler ,renameValidator} from "../lib/validators.js";
import { isAuthenticated } from "../middleware/auth.js";
import { attachmentMulter } from "../middleware/multer.js";

const app=express.Router();

//protected routes
app.use(isAuthenticated)

app.post("/new",newGroupChatValidator(), validateHandler,newGroupchat)

app.get('/my',getMychat)
app.get('/my/groups',getMyGroups)
app.put('/addmembers',addMemberValditor(), validateHandler,addMembers)
app.put('/removemember',removeMemberValditor(), validateHandler,removeMember)
app.delete('/leave/:id',chatIdValidator(), validateHandler, leaveGroup)

app.post('/message', attachmentMulter,sendAttachmentValidator(),validateHandler, sendAttachments)

app.get('/message/:id',chatIdValidator(), validateHandler,getMessage)

app.route("/:id")
.get(chatIdValidator(), validateHandler,getChatDetails)
.put(renameValidator(), validateHandler,renameGroup)
.delete(chatIdValidator(), validateHandler,deleteChat)
export default app;