import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import db from "./db.js";

passport.serializeUser((user, done) => {
  try {
    done(null, user.id);
  } catch (err) {
    done(err, null);
  }
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, avatar FROM users WHERE id = $1",
      [id]
    );
    done(null, result.rows[0] || null);
  } catch (err) {
    console.error("DeserializeUser Error:", err);
    done(err, null);
  }
});

// Configure Google OAuth Strategy if keys are present
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails && profile.emails[0]
              ? profile.emails[0].value
              : null;
          const googleId = profile.id;
          const name =
            profile.displayName ||
            (profile.name
              ? `${profile.name.givenName || ""} ${profile.name.familyName || ""}`.trim()
              : "Google User");
          const avatar =
            profile.photos && profile.photos[0] ? profile.photos[0].value : null;

          // 1. Check if user exists by google_id
          const userById = await db.query(
            "SELECT * FROM users WHERE google_id = $1",
            [googleId]
          );
          if (userById.rows.length > 0) {
            return done(null, userById.rows[0]);
          }

          // 2. Check if user exists by email
          if (email) {
            const userByEmail = await db.query(
              "SELECT * FROM users WHERE email = $1",
              [email]
            );
            if (userByEmail.rows.length > 0) {
              const updatedUser = await db.query(
                "UPDATE users SET google_id = $1, avatar = COALESCE(avatar, $2) WHERE email = $3 RETURNING *",
                [googleId, avatar, email]
              );
              return done(null, updatedUser.rows[0]);
            }
          }

          // 3. Otherwise create new user
          const newUser = await db.query(
            "INSERT INTO users (name, email, google_id, avatar) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, email || `${googleId}@google.com`, googleId, avatar]
          );
          return done(null, newUser.rows[0]);
        } catch (err) {
          console.error("Google Strategy verify error:", err);
          return done(err, null);
        }
      }
    )
  );
}

// Configure GitHub OAuth Strategy if keys are present
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || "/auth/github/callback",
        scope: ["user:email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails && profile.emails[0]
              ? profile.emails[0].value
              : profile._json?.email || null;
          const githubId = profile.id.toString();
          const name = profile.displayName || profile.username || "GitHub User";
          const avatar =
            profile.photos && profile.photos[0]
              ? profile.photos[0].value
              : profile._json?.avatar_url || null;

          // 1. Check if user exists by github_id
          const userById = await db.query(
            "SELECT * FROM users WHERE github_id = $1",
            [githubId]
          );
          if (userById.rows.length > 0) {
            return done(null, userById.rows[0]);
          }

          // 2. Check if user exists by email
          if (email) {
            const userByEmail = await db.query(
              "SELECT * FROM users WHERE email = $1",
              [email]
            );
            if (userByEmail.rows.length > 0) {
              const updatedUser = await db.query(
                "UPDATE users SET github_id = $1, avatar = COALESCE(avatar, $2) WHERE email = $3 RETURNING *",
                [githubId, avatar, email]
              );
              return done(null, updatedUser.rows[0]);
            }
          }

          // 3. Otherwise create new user
          const newUser = await db.query(
            "INSERT INTO users (name, email, github_id, avatar) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, email || `${githubId}@github.com`, githubId, avatar]
          );
          return done(null, newUser.rows[0]);
        } catch (err) {
          console.error("GitHub Strategy verify error:", err);
          return done(err, null);
        }
      }
    )
  );
}

export default passport;
