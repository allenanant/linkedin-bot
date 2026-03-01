import express from "express";
import open from "open";
import dotenv from "dotenv";
import path from "path";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getPersonUrn,
  updateEnvFile,
} from "../src/linkedin/auth";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || "http://localhost:3456/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(`
ERROR: Missing LinkedIn credentials.

1. Go to https://developer.linkedin.com/apps
2. Create a new app (or use existing)
3. Request access to "Community Management API"
4. Copy the Client ID and Client Secret
5. Add them to your .env file:

   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret

6. In your LinkedIn app settings, add this redirect URL:
   ${REDIRECT_URI}

Then run this script again.
  `);
  process.exit(1);
}

const app = express();
const PORT = 3456;

app.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    res.send(`<h2>Authorization failed</h2><p>${error}</p>`);
    console.error(`OAuth error: ${error}`);
    process.exit(1);
  }

  if (!code) {
    res.send("<h2>No authorization code received</h2>");
    process.exit(1);
  }

  try {
    console.log("Exchanging code for tokens...");
    const tokens = await exchangeCodeForTokens(code, CLIENT_ID!, CLIENT_SECRET!, REDIRECT_URI);

    console.log("Fetching user profile...");
    const personUrn = await getPersonUrn(tokens.accessToken);

    // Save tokens to .env
    updateEnvFile("LINKEDIN_ACCESS_TOKEN", tokens.accessToken);
    updateEnvFile("LINKEDIN_REFRESH_TOKEN", tokens.refreshToken);
    updateEnvFile("LINKEDIN_PERSON_URN", personUrn);

    console.log("\nSetup complete!");
    console.log(`  Access Token: ${tokens.accessToken.slice(0, 20)}...`);
    console.log(`  Person URN: ${personUrn}`);
    console.log(`  Token expires in: ${tokens.expiresIn} seconds`);
    console.log("\nTokens saved to .env file.");

    res.send(`
      <h2>LinkedIn Bot Setup Complete!</h2>
      <p>Your access token and person URN have been saved to .env</p>
      <p>Person URN: ${personUrn}</p>
      <p>You can close this window and return to the terminal.</p>
    `);

    setTimeout(() => process.exit(0), 2000);
  } catch (err: any) {
    console.error(`Token exchange failed: ${err.message}`);
    res.send(`<h2>Error</h2><p>${err.message}</p>`);
    process.exit(1);
  }
});

app.listen(PORT, () => {
  const authUrl = getAuthorizationUrl(CLIENT_ID!, REDIRECT_URI);
  console.log(`\nLinkedIn Bot - OAuth Setup`);
  console.log(`==========================\n`);
  console.log(`Opening browser for authorization...`);
  console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);

  open(authUrl);
});
