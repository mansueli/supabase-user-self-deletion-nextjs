import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts'

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/

function isValidPassword(value: string) {
  return passwordPattern.test(value)
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

  const supabaseClient = createClient(
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

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(req, { error: 'Unauthorized' }, 401)
  }

  let payload: { oldPassword?: unknown; newPassword?: unknown }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid request body' }, 400)
  }

  const { oldPassword, newPassword } = payload

  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
    return jsonResponse(req, { error: 'Passwords must be strings' }, 400)
  }

  if (!isValidPassword(newPassword)) {
    return jsonResponse(
      req,
      {
        error:
          'New password must be at least 8 characters long and include uppercase, lowercase, numeric, and special characters',
      },
      400
    )
  }

  if (oldPassword === newPassword) {
    return jsonResponse(req, { error: 'New password must differ from the current password' }, 400)
  }

  const { data: isValidOldPassword, error: passwordError } = await supabaseClient.rpc(
    'verify_user_password',
    { password: oldPassword }
  )

  if (passwordError || !isValidOldPassword) {
    return jsonResponse(req, { error: 'Invalid old password' }, 400)
  }

  try {
    const { error: updateError } = await supabaseClient.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return jsonResponse(req, { error: updateError.message }, 400)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update password'
    return jsonResponse(req, { error: message }, 400)
  }

  return jsonResponse(req, { message: 'Password updated successfully' }, 200)
})
