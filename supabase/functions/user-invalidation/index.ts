import { serve } from 'https://deno.land/std@0.182.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.14.0'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "user-invalidation" up and running!`)

serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client with Auth context of the user that called the function.
      // This way your row-level-security (RLS) policies are applied.
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    // Now we can get the session or user object
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    // And we can run queries in the context of our authenticated user
    const { data: profiles, error: user_error } = await supabaseClient.from('profiles').select('id')
    if (user_error) throw user_error
    const user_id = profiles[0].id
    // Create the admin client to delete files & user with the Admin API.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: invalidate_user, invalidation_error } = await supabaseAdmin.auth.admin.updateUserById(
      '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
      {   
        email: user_id.concat('@deleted-users.example.com'), 
        phone: "", 
        user_metadata: { deleted: true },
        app_metadata:  { deleted: true }
      }
    )
    if (invalidation_error) throw invalidation_error
    const { data: invalidate_profile, invalid_profile_error } = await supabaseAdmin.from('profiles')
    .update({ full_name: '', username: '', avatar_url: '', website:''})
    .eq('id', user_id)
    if (invalid_profile_error) throw invalid_profile_error
    console.log('profile_invalidated:'+JSON.stringify(invalidate_profile, null, 2))
    return new Response("User invalidated: " + JSON.stringify(invalidate_user, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})