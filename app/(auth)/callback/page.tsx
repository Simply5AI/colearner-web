import { redirect } from 'next/navigation'
/** Auth.js completes provider callbacks at /api/auth; keep the historical UI URL usable. */
export default function CallbackPage() { redirect('/') }
