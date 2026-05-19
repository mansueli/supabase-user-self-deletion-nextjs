const defaultAllowedOrigins = ['http://localhost:3000', 'https://localhost:3000']

const allowedOrigins = (
  Deno.env.get('ALLOWED_ORIGINS')?.split(',').map((origin) => origin.trim()).filter(Boolean) ??
  defaultAllowedOrigins
)

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin')

  return {
    ...(origin && allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    Vary: 'Origin',
  }
}

export function jsonResponse(req: Request, body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    status,
  })
}
