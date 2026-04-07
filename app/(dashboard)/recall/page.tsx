import { redirect } from 'next/navigation'

export default function RecallPage() {
  redirect('/practice?tab=sources')
}
