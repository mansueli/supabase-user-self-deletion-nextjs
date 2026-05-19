import { serve } from 'https://deno.land/std@0.182.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.14.0'
import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts'

console.log('Function "user-self-deletion" up and running!')

function createAuthorizedClient(authorization: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405)
  }

  const authorization = req.headers.get('Authorization')
  if (!authorization) {
    return jsonResponse(req, { error: 'Missing authorization header' }, 401)
  }

  try {
    const supabaseClient = createAuthorizedClient(authorization)
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse(req, { error: 'Unauthorized' }, 401)
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const supabaseAdmin = createAdminClient()

    if (profile?.avatar_url) {
      const { error: avatarError } = await supabaseAdmin.storage
        .from('avatars')
        .remove([profile.avatar_url])

      if (avatarError) {
        throw avatarError
      }
    }

    const { error: deletionError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deletionError) {
      throw deletionError
    }

    return jsonResponse(req, { message: 'User deleted' }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete user'
    return jsonResponse(req, { error: message }, 400)
  }
})
