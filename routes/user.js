import  express  from "express";
import { getMyProfile, newUser, userLogin , logout, searchUser, sendFriendRequest, acceptFriendRequest, getMyNotifications,getMyFriends} from "../controllers/userController.js";
import { singleAvatar } from "../middleware/multer.js";
import { isAuthenticated } from "../middleware/auth.js";
import { acceptRequestValidator, loginValidator, registerValidator , sendRequestValidator, validateHandler} from "../lib/validators.js";
const app=express.Router();

app.post('/login',loginValidator(),validateHandler, userLogin );
app.post('/new',singleAvatar,registerValidator(),validateHandler, newUser );


//protected routes
app.use(isAuthenticated)
app.get('/me', getMyProfile)
app.get('/logout', logout)
app.get('/search', searchUser)
app.put('/sendrequest',sendRequestValidator(),validateHandler, sendFriendRequest)
app.put('/acceptrequest',acceptRequestValidator(),validateHandler, acceptFriendRequest)
app.get('/notifications', getMyNotifications)
app.get('/friends', getMyFriends)

export default app;