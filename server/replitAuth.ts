import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    try {
      console.log("Discovering OIDC config with REPL_ID:", process.env.REPL_ID);
      const config = await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
      console.log("OIDC Config discovered successfully");
      return config;
    } catch (error) {
      console.error("OIDC Config Error:", error);
      throw error;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  let config;
  try {
    config = await getOidcConfig();
    console.log("OIDC Config loaded successfully");
  } catch (error) {
    console.error("Failed to load OIDC config:", error);
    throw error;
  }

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    console.log(`Setting up strategy for domain: ${domain}`);
    console.log(`Callback URL will be: https://${domain}/api/callback`);
    
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
    console.log(`Registered auth strategy for domain: ${domain}`);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Use the first domain from REPLIT_DOMAINS instead of req.hostname for local dev
    const domain = process.env.REPLIT_DOMAINS!.split(",")[0];
    console.log("Login attempt for domain:", domain, "hostname:", req.hostname);
    passport.authenticate(`replitauth:${domain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Use the first domain from REPLIT_DOMAINS instead of req.hostname for local dev
    const domain = process.env.REPLIT_DOMAINS!.split(",")[0];
    console.log("=== OAUTH CALLBACK START ===");
    console.log("Callback for domain:", domain, "hostname:", req.hostname);
    console.log("Callback query params:", JSON.stringify(req.query, null, 2));
    console.log("Callback headers:", JSON.stringify({
      'user-agent': req.headers['user-agent'],
      'referer': req.headers['referer'],
      'host': req.headers['host']
    }, null, 2));
    
    // Check if we have the required parameters
    if (!req.query.code && !req.query.error) {
      console.error("No authorization code or error in callback");
      return res.status(400).send("Invalid callback - missing code or error parameter");
    }
    
    if (req.query.error) {
      console.error("OAuth error in callback:", req.query.error, req.query.error_description);
      return res.status(400).send(`OAuth error: ${req.query.error} - ${req.query.error_description}`);
    }
    
    passport.authenticate(`replitauth:${domain}`, (err, user, info) => {
      console.log("Passport authenticate result:");
      console.log("- Error:", err);
      console.log("- User:", user ? "User object present" : "No user");
      console.log("- Info:", info);
      
      if (err) {
        console.error("Authentication error details:", err);
        return res.status(500).send(`Authentication error: ${err.message}`);
      }
      if (!user) {
        console.error("Authentication failed - no user. Info:", info);
        return res.status(401).send(`Authentication failed: ${info ? info.message || info : 'Unknown error'}`);
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).send(`Login error: ${err.message}`);
        }
        console.log("Authentication successful, redirecting to /");
        console.log("=== OAUTH CALLBACK SUCCESS ===");
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};