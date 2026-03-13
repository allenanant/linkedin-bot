import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import axios from "axios";

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";

async function main() {
  // Check the latest published post
  const postUrns = [
    "urn:li:share:7433946555662893058",  // latest repost of #5
    "urn:li:share:7433933273342414848",  // original post #5
  ];

  for (const urn of postUrns) {
    console.log(`\n=== Checking ${urn} ===`);
    try {
      const encodedUrn = encodeURIComponent(urn);
      const response = await axios.get(
        `https://api.linkedin.com/rest/posts/${encodedUrn}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": "202602",
          },
        }
      );
      const data = response.data;
      console.log("Status:", response.status);
      console.log("Commentary length:", data.commentary?.length);
      console.log("Commentary:\n---START---");
      console.log(data.commentary);
      console.log("---END---");
      console.log("Lifecycle state:", data.lifecycleState);
    } catch (err: any) {
      console.error("Error:", err.response?.status, err.response?.data || err.message);
    }
  }
  process.exit(0);
}

main();
