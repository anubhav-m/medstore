export const sendSuccess = (res, { message, data, meta }) =>
  res.status(200).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  });
