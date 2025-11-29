import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = "REDACTED_SUPABASE_KEY";

// MUST use service role key
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createUserWithProfile(email, password, role = "vendor") {
  console.log("Creating auth user...");

  // Step 1 — Create the user in auth.users
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    console.error("Error creating user:", error);
    return;
  }

  const user = data.user;
  console.log("Auth user created:", user.id);

  // Step 2 — Insert into profiles table
  console.log("Creating profile...");

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,          // MUST match auth.users.id
      email,
      role
    });

  if (profileError) {
    console.error("Error creating profile:", profileError);
    return;
  }

  console.log("Profile created successfully for:", email);
}

// Example call:
createUserWithProfile(
  "hello+1@example.com",
  "StrongPassword123!",
  "vendor"
)
  .then(() => console.log("Done"))
  .catch((err) => console.error(err));