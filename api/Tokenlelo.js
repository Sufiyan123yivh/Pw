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

// Convert UTC timestamp to IST in DD-MM-YYYY HH:MM:SS format
function formatIST(timestamp) {
  const dateUTC = new Date(timestamp);
  const istTime = new Date(dateUTC.getTime() + 5.5 * 60 * 60 * 1000); // UTC+5:30
  const dd = String(istTime.getDate()).padStart(2, '0');
  const mm = String(istTime.getMonth() + 1).padStart(2, '0'); // Months start at 0
  const yyyy = istTime.getFullYear();
  const hh = String(istTime.getHours()).padStart(2, '0');
  const min = String(istTime.getMinutes()).padStart(2, '0');
  const ss = String(istTime.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
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
    expiresAtIST: formatIST(expiration),
  });
}
