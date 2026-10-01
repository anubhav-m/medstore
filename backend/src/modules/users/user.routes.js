import { Router } from "express";
import { authCustomer } from "../../middleware/authCustomer.js";
import { getMe } from "./user.controller.js";

export const userRoutes = Router();

userRoutes.get("/me", authCustomer, getMe);
