// api/services/googleCalendarService.js
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('googleCalendarService: GOOGLE_CLIENT_ID/SECRET not set');
}

function makeOAuthClient() {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  return oauth2;
}

/**
 * Create a Google Calendar event with a Meet conference.
 * - refreshToken: user's refresh token (required)
 * - summary, description, start (ISO string), end (ISO string)
 * - attendees: array of { email } objects (optional)
 *
 * Returns the created event (google's event object)
 */
async function createCalendarEventWithMeet({ refreshToken, summary, description, start, end, attendees = [] }) {
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');

  const oauth2Client = makeOAuthClient();
  // set refresh token so googleapis can use it to fetch an access token
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Create calendar client
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Build event body
  const eventBody = {
    summary: summary || 'Meeting',
    description: description || '',
    start: { dateTime: start || new Date().toISOString() },
    end: { dateTime: end || new Date(Date.now() + 30 * 60000).toISOString() },
    attendees: attendees || [],
    conferenceData: {
      createRequest: {
        requestId: uuidv4(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  // Insert event
  const resp = await calendar.events.insert({
    calendarId: 'primary',
    resource: eventBody,
    conferenceDataVersion: 1,
    sendUpdates: 'all', // can be 'none' if you don't want auto invites
  });

  // resp.data contains event
  return resp.data;
}

module.exports = {
  createCalendarEventWithMeet,
};

