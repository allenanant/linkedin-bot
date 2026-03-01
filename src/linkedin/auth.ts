import axios from "axios";
import fs from "fs";
import path from "path";

const ENV_PATH = path.resolve(__dirname, "../../.env");

export interface LinkedInTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<LinkedInTokens> {
  const response = await axios.post(
    "https://www.linkedin.com/oauth/v2/accessToken",
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token || "",
    expiresIn: response.data.expires_in,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<LinkedInTokens> {
  const response = await axios.post(
    "https://www.linkedin.com/oauth/v2/accessToken",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token || refreshToken,
    expiresIn: response.data.expires_in,
  };
}

export async function getPersonUrn(accessToken: string): Promise<string> {
  const response = await axios.get("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return `urn:li:person:${response.data.sub}`;
}

export function getAuthorizationUrl(clientId: string, redirectUri: string): string {
  const scopes = ["openid", "profile", "w_member_social"];
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state: "linkedin-bot-setup",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function updateEnvFile(key: string, value: string) {
  let envContent = "";
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, "utf-8");
  }

  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, envContent);
}
