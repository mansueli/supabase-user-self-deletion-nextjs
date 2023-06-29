import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  console.log("Request received:"+req.headers.get("Authorization")!);
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );
  console.log("Supabase client created");

  const { data: { user }, error: userError } = await supabaseClient.auth
    .getUser();
  console.log("User fetched", user);
  if (userError) {
    console.error("User error", userError);
    return new Response(JSON.stringify({ error: userError.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
  const { oldPassword, newPassword } = await req.json();
  console.log("Received old and new passwords", oldPassword, newPassword);

  const { data: isValidOldPassword, error: passwordError } =
    await supabaseClient.rpc("verify_user_password", { password: oldPassword });
  console.log("Old password verified", isValidOldPassword);
  if (passwordError || !isValidOldPassword) {
    console.error("Invalid old password", passwordError);
    return new Response(JSON.stringify({ error: "Invalid old password" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
  try {
    const { data: profiles, error: profileError } = await supabaseClient.from(
      "profiles",
    ).select("id, avatar_url");
    console.log("Profile data fetched", profiles);
    if (profileError) throw profileError;
    const user_id = profiles[0].id;
    console.log("User id", user_id);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );
    console.log("Admin client created");

    const { error: updateError } = await supabaseAdmin
      .auth.admin.updateUserById(
        user_id,
        { password: newPassword },
      );
    console.log("Password updated");
    if (updateError) {
      console.error("Update error", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
      });
    }
  } catch (error) {
    console.error("Caught error", error);
    return new Response(JSON.stringify({ error: error }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
  console.log("Password update successful");
  return new Response(
    JSON.stringify({ message: "Password updated successfully" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    },
  );
});
