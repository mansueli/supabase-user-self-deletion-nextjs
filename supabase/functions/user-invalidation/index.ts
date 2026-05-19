import { serve } from 'https://deno.land/std@0.182.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.14.0'
import { getCorsHeaders, hasAllowedOrigin, jsonResponse } from '../_shared/cors.ts'

console.log('Function "user-invalidation" up and running!')

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
  if (!hasAllowedOrigin(req)) {
    return jsonResponse(req, { error: 'Origin not allowed' }, 403)
  }

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

    if (userError) {
      return jsonResponse(req, { error: 'Authentication failed' }, 401)
    }

    if (!user) {
      return jsonResponse(req, { error: 'User not found' }, 404)
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    if (!profile) {
      return jsonResponse(req, { error: 'Profile not found' }, 404)
    }

    const supabaseAdmin = createAdminClient()

    const { error: invalidationError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: `${user.id}@deleted-users.example.com`,
      phone: '',
      user_metadata: { ...user.user_metadata, deleted: true },
      app_metadata: { ...user.app_metadata, deleted: true },
    })
    if (invalidationError) {
      throw invalidationError
    }

    if (profile.avatar_url) {
      const { error: avatarError } = await supabaseAdmin.storage
        .from('avatars')
        .remove([profile.avatar_url])

      if (avatarError) {
        throw avatarError
      }
    }

    const { error: invalidProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: null,
        username: null,
        avatar_url: null,
        website: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (invalidProfileError) {
      throw invalidProfileError
    }

    return jsonResponse(req, { message: 'User invalidated' }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to invalidate user'
    return jsonResponse(req, { error: message }, 400)
  }
})
