import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export function getPostHogClient() {
  if (!posthogClient && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      // Remove the invalid capture_pageview option
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return posthogClient
}

export async function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) {
  const client = getPostHogClient()
  if (client) {
    client.capture({
      distinctId,
      event,
      properties,
    })
  }
}

export async function identifyUser(
  distinctId: string,
  properties?: Record<string, any>
) {
  const client = getPostHogClient()
  if (client) {
    client.identify({
      distinctId,
      properties,
    })
  }
}

export async function flushPostHog() {
  const client = getPostHogClient()
  if (client) {
    await client.flush()
  }
}