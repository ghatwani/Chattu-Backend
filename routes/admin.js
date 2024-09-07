import express from "express";
import { allUsers,allChats, allMessages,getDashboardStats,adminLogin ,adminLogout,getAdminData} from "../controllers/adminController.js";
import { adminLoginValidator, validateHandler } from "../lib/validators.js";
import { adminOnly } from "../middleware/auth.js";

const app=express.Router();

app.post("/verify",adminLoginValidator(),validateHandler,  adminLogin)

app.get("/logout", adminLogout)

app.use(adminOnly)
app.get("/", getAdminData)
app.get("/users", allUsers)
app.get("/messages", allMessages)
app.get("/chats",allChats)

app.get("/stats",getDashboardStats)


export default app;