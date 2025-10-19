// /api/token.js
let tempToken = null;
let expiration = 0;

function generateToken(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default function handler(req, res) {
  // Check if token exists and is still valid
  if (!tempToken || Date.now() > expiration) {
    tempToken = generateToken();
    expiration = Date.now() + 30 * 60 * 1000; // 30 minutes
    console.log(`New token generated: ${tempToken}`);
  }

  res.status(200).json({
    token: tempToken,
    expiresAt: new Date(expiration).toISOString(),
  });
}
