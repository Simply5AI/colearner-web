import { NextRequest, NextResponse } from 'next/server'

/**
 * CORS proxy for BYOK (Bring Your Own Key) LLM calls.
 *
 * OpenAI and Anthropic APIs don't allow direct browser requests (no CORS headers).
 * This route forwards the request using the user's API key, then discards it.
 *
 * Security:
 * - API key is used for the outbound fetch only, never persisted or logged
 * - Request body validated before forwarding
 * - Rate limiting recommended via middleware
 */

interface ProxyRequest {
  provider: 'openai' | 'anthropic'
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
}

function isValidRequest(body: unknown): body is ProxyRequest {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    (b.provider === 'openai' || b.provider === 'anthropic') &&
    typeof b.apiKey === 'string' &&
    b.apiKey.length > 0 &&
    typeof b.model === 'string' &&
    Array.isArray(b.messages) &&
    b.messages.length > 0
  )
}

async function forwardToOpenAI(req: ProxyRequest): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
    }),
  })
}

async function forwardToAnthropic(req: ProxyRequest): Promise<Response> {
  // Extract system message for Anthropic's separate system param
  const systemMessage = req.messages.find((m) => m.role === 'system')
  const nonSystemMessages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature ?? 0.7,
    messages: nonSystemMessages,
  }

  if (systemMessage) {
    body.system = systemMessage.content
  }

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isValidRequest(body)) {
    return NextResponse.json(
      { error: 'Invalid request. Required: provider, apiKey, model, messages' },
      { status: 400 }
    )
  }

  try {
    let providerRes: Response

    if (body.provider === 'openai') {
      providerRes = await forwardToOpenAI(body)
    } else {
      providerRes = await forwardToAnthropic(body)
    }

    if (!providerRes.ok) {
      const errText = await providerRes.text().catch(() => providerRes.statusText)
      // Parse provider-specific error messages
      let errorMessage: string
      try {
        const errJson = JSON.parse(errText)
        errorMessage =
          errJson.error?.message || errJson.error?.type || errText
      } catch {
        errorMessage = errText
      }
      return NextResponse.json(
        { error: `${body.provider} API error: ${errorMessage}` },
        { status: providerRes.status }
      )
    }

    // Parse and normalize the response
    if (body.provider === 'openai') {
      const data = (await providerRes.json()) as {
        choices: Array<{ message: { content: string } }>
        model: string
        usage: { prompt_tokens: number; completion_tokens: number }
      }

      return NextResponse.json({
        content: data.choices[0]?.message?.content ?? '',
        model: data.model,
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      })
    } else {
      const data = (await providerRes.json()) as {
        content: Array<{ type: string; text?: string }>
        model: string
        usage: { input_tokens: number; output_tokens: number }
      }

      const text = data.content.find((b) => b.type === 'text')?.text ?? ''

      return NextResponse.json({
        content: text,
        model: data.model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      })
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Proxy request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
