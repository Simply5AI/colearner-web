import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { FamilyScreen } from '@/components/family/family-screen'
import { LoadingState } from '@/components/design-system'
export default async function FamilyPage() {const session=await auth();if(!session?.accessToken||!session.user?.id)redirect('/login?callbackUrl=/family');return <Suspense fallback={<LoadingState/>}><FamilyScreen/></Suspense>}
