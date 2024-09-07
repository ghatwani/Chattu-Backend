import { ErrorHandler } from "../utils/utility.js";
import { TryCatch } from "./error.js";
import jwt  from "jsonwebtoken";
import { adminSecretKey } from "../app.js";
import { User } from "../models/user.js";
import { CHATTU_TOKEN } from "../config/config.js";



const isAuthenticated=TryCatch(async(req, res, next)=>{
    const token= req.cookies[CHATTU_TOKEN]
    // console.log(token)
    if(!token) return next(new ErrorHandler("please login to access this route", 401))

    const decodedData=jwt.verify(token , process.env.JWT_SECRET)
    // console.log(decodedData)
    req.user=decodedData._id;
    next();
})
const adminOnly=TryCatch(async(req, res, next)=>{
    const token= req.cookies["chattu-admin-token"]
    console.log(token)
    if(!token) return next(new ErrorHandler("Only admin can  access this route", 401))

    const secretKey=jwt.verify(token , process.env.JWT_SECRET);
    const isMatched =secretKey === adminSecretKey
    if(!isMatched) return next(new ErrorHandler("Only admin can  access this route", 401))
 
    next();
})
const socketAuthenticator=async(err, socket, next)=>{
 try {
    if(err){
        return next(new ErrorHandler("Please login to access this route", 401))
    }
    const authToken= socket.request.cookies[CHATTU_TOKEN]
    if(!authToken) return next(new ErrorHandler("Please login to access this route", 401))
    
    const decodedData= jwt.verify(authToken, process.env.JWT_SECRET)

    const user= await User.findById(decodedData._id)

    if(!user) return next(new ErrorHandler("User not found", 401))
    socket.user= user
    return next()
 } catch (error) {
    return next(new ErrorHandler("Please login to access this route", 401))
 }
}
export{isAuthenticated, adminOnly, socketAuthenticator}