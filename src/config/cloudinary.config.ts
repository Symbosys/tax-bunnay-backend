import { v2 as cloudinary } from "cloudinary";
import env from "./env.config.ts";

cloudinary.config({
  cloud_name: env.cloudinary.name,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

export default cloudinary;
