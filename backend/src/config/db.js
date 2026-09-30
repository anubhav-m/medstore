import mongoose from "mongoose";

mongoose.set("strictQuery", true);

export const connectDb = async (uri) => {
  await mongoose.connect(uri);
};

export const disconnectDb = async () => {
  await mongoose.disconnect();
};

export const isDbConnected = () =>
  mongoose.connection.readyState === mongoose.ConnectionStates.connected;
