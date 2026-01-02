// api/config/google.js
// CommonJS helper used by services/googleService.js

const querystring = require("querystring");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || "/api/oauth/google/callback";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events"
];

function getGoogleAuthUrl(state = "") {
  const base = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline", // critical to receive refresh_token
    prompt: "consent", // ensures refresh_token is returned at first consent
    scope: SCOPES.join(" "),
    state: state,
  };
  return `${base}?${querystring.stringify(params)}`;
}

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  SCOPES,
  getGoogleAuthUrl,
};
