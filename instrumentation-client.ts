import * as Sentry from '@sentry/nextjs'

const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV
const enabled = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN &&
    (environment === 'development' || environment === 'staging'),
)

if (enabled) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '1'),
    beforeSend(event) {
      if (event.request?.cookies) {
        delete event.request.cookies
      }
      return event
    },
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
