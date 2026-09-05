import "dotenv/config";

export const env = {
  db: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  server: {
    port: Number(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
  },
  cloudinary: {
    name: process.env.CLOUD_NAME,
    apiKey: process.env.CLOUD_API_KEY,
    apiSecret: process.env.CLOUD_API_SECRET,
    folder: process.env.CLOUD_FOLDER,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
};

export default env;
