const passport = require("passport");
const pool = require("../database/database");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.clientID,
      clientSecret: process.env.clientSecret,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        const result = await pool.query(
          `SELECT * FROM users WHERE email = $1 AND is_active = true`,
          [email]
        );

        if (result.rows.length === 0) {
          // ❌ User does NOT exist → block login
          return done(null, false, {
            message: "No account found. Please sign up first.",
          });
        }

        const user = result.rows[0];

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);
