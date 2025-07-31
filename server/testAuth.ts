// Simple auth test to diagnose the issue
import type { Express } from "express";

export function setupTestAuth(app: Express) {
  // Simple test route to check if basic auth flow works
  app.get("/api/test-auth", (req, res) => {
    console.log("Test auth endpoint hit");
    res.setHeader('Content-Type', 'application/json');
    res.json({
      hostname: req.hostname,
      protocol: req.protocol,
      headers: Object.keys(req.headers),
      env: {
        REPL_ID: process.env.REPL_ID,
        REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
        NODE_ENV: process.env.NODE_ENV,
        hasSessionSecret: !!process.env.SESSION_SECRET
      }
    });
  });

  // Simple login redirect test
  app.get("/api/simple-login", (req, res) => {
    // Use the actual Replit domain instead of localhost
    const domain = process.env.REPLIT_DOMAINS!.split(",")[0];
    console.log("Simple login endpoint hit - using domain:", domain, "instead of hostname:", req.hostname);
    const replitAuthUrl = `https://replit.com/oidc/auth?client_id=${process.env.REPL_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri=https://${domain}/api/callback&prompt=login%20consent`;
    console.log("Redirecting to:", replitAuthUrl);
    res.redirect(302, replitAuthUrl);
  });

  // Test callback endpoint to see what Replit is sending
  app.get("/api/test-callback", (req, res) => {
    console.log("=== TEST CALLBACK ===");
    console.log("Query params:", JSON.stringify(req.query, null, 2));
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    res.json({
      message: "Test callback received",
      query: req.query,
      headers: req.headers
    });
  });
}