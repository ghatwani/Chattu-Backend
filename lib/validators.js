import {body, check, param, validationResult} from 'express-validator'
import { ErrorHandler } from '../utils/utility.js'

const validateHandler=(req, res, next)=>{
    const errors=validationResult(req)
    const errorMessages=errors.array().map((error)=>error.msg).join(',')

    // console.log(errorMessages)

    if(errors.isEmpty()) return next()
    return next(new ErrorHandler(errorMessages, 400))
}

const registerValidator=()=>[
    body("name","Please enter name").notEmpty(),
    body("username","Please enter username").notEmpty(),
    body("bio","Please enter bio").notEmpty(),
    body("password","Please enter password").notEmpty(),
    // check("avatar","Please upload avatar").notEmpty(),
]
const loginValidator=()=>[
    body("username","Please enter username").notEmpty(),
    body("password","Please enter password").notEmpty(),
]

const newGroupChatValidator=()=>[
    body("name", "Please Enter Name").notEmpty(),
    body("members").notEmpty().withMessage("please enter members").isArray({min:3, max:100}).withMessage("members should be between 3 to 100")

]

const addMemberValditor=()=>[
    body("chatId", "Please Enter chat Id").notEmpty(),
    body("members").notEmpty().withMessage("please enter members").isArray({min:1, max:97}).withMessage("members should be between 3 to 100")
]

const removeMemberValditor=()=>[
    body("chatId", "Please Enter chat Id").notEmpty(),
    body("userId", "Please Enter user Id").notEmpty(),
]
const sendAttachmentValidator=()=>[
    body("chatId", "Please Enter chat Id").notEmpty()
]
const chatIdValidator=()=>[
    param("id", "Please Enter chat Id").notEmpty(),
]
const renameValidator=()=>[
    param("id", "Please enter chat Id").notEmpty(),
    body("name", "please enter new name").notEmpty()

]

const sendRequestValidator=()=>[
    body("userId","please Enter User id").notEmpty()
]
const acceptRequestValidator=()=>[
    body("requestId","please Enter request id").notEmpty(),
    body("accept")
    .notEmpty()
    .withMessage("please add accept")
    .isBoolean()
    .withMessage("must be boolean")
]
const adminLoginValidator=()=>[
    body("secretKey", "Please Enter Secret Key").notEmpty()
]

export{registerValidator, validateHandler,loginValidator, newGroupChatValidator,addMemberValditor,removeMemberValditor,sendAttachmentValidator,chatIdValidator,renameValidator,sendRequestValidator,acceptRequestValidator,adminLoginValidator}