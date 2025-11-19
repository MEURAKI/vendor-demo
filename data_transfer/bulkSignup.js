const fs = require("fs");
const axios = require("axios");
const csv = require("csv-parser");
const { format } = require("@fast-csv/format");

require("dotenv").config();

const INPUT_FILE = "emails.csv";
const OUTPUT_FILE = "created_users.csv";

// ---- CONFIG ----
const SUPABASE_URL = "https://kltjywhkfwoaefxtzztg.supabase.co";
const SERVICE_ROLE = "REDACTED_SERVICE_ROLE_KEY"; // MUST be service_role!

const SIGNUP_URL = `${SUPABASE_URL}/auth/v1/signup`;
const PROFILE_INSERT_URL = `${SUPABASE_URL}/rest/v1/profiles`;

const HARD_PASSWORD = "T9@pZ!4qN7$wR3&dX0*";

const CODE_CHALLENGE =
  "uS9zVjUNDm8twUnmHNR5mQMgQwNLRK2VWntpoMU0Aks";

// -----------------

async function createAuthUser(email) {
  try {
    const res = await axios.post(
      SIGNUP_URL,
      {
        email,
        password: HARD_PASSWORD,
        gotrue_meta_security: {},
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: "s256",
      },
      {
        headers: {
          apikey: SERVICE_ROLE,
          "Content-Type": "application/json",
        },
      }
    );

    const userId = res.data?.user?.id;
    return userId || null;
  } catch (err) {
    console.error("Auth error:", email, err.response?.data || err.message);
    return null;
  }
}

async function createProfile(userId, email) {
  try {
    const res = await axios.post(
      PROFILE_INSERT_URL,
      [
        {
          id: userId,
          email: email,
          created_at: new Date().toISOString(),
        },
      ],
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
      }
    );

    return true;
  } catch (err) {
    const data = err.response?.data;

    // 🔥 If the profile already exists, just skip and treat as success
    if (data?.code === "23505") {
      console.log("Profile already exists, skipping:", email);
      return true;
    }

    console.error("Profile insert error:", email, data || err.message);
    return false;
  }
}

function readEmails() {
  return new Promise((resolve, reject) => {
    const emails = [];

    fs.createReadStream(INPUT_FILE)
      .pipe(csv())
      .on("data", (row) => {
        const email = (row.email || "").trim();
        if (email) emails.push(email);
      })
      .on("end", () => resolve(emails))
      .on("error", reject);
  });
}

async function run() {
  const emails = await readEmails();

  const outputStream = fs.createWriteStream(OUTPUT_FILE);
  const csvStream = format({ headers: true });
  csvStream.pipe(outputStream);

  for (const email of emails) {
    console.log("Creating user:", email);

    // 1️⃣ AUTH USER
    const userId = await createAuthUser(email);

    if (!userId) {
      csvStream.write({ email, user_id: "AUTH_ERROR" });
      continue;
    }

    // 2️⃣ PROFILE ROW
    const profileOK = await createProfile(userId, email);

    csvStream.write({
      email,
      user_id: userId,
      profile_created: profileOK ? "YES" : "FAIL",
    });
  }

  csvStream.end();
  console.log("DONE → saved to", OUTPUT_FILE);
}

run();