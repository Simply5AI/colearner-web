import type {FamilyAccountAccess} from '@colearner/api-client'
import {familyRequest,FamilyError} from '@/lib/api/family'

/** A minimal live server decision, never a browser DOB or editable Auth.js claim. */
export async function accountFamilyAccess(token:string):Promise<FamilyAccountAccess> {
  const status=await familyRequest<FamilyAccountAccess>(token,'/family/access-status')
  if(!status||!['AGE_CHECK','CHILD_PROFILE','ADULT_ONBOARDING'].includes(status.next)||![null,'UNDER_6','KIDS','TWEENS','TEENS','ADULT'].includes(status.ageBand))throw new FamilyError(503,'Your account access could not be checked. Please try again.')
  if(status.next==='ADULT_ONBOARDING'&&status.ageBand!=='ADULT'||status.next==='CHILD_PROFILE'&&!['KIDS','TWEENS','TEENS'].includes(status.ageBand??''))throw new FamilyError(503,'Your account access could not be checked. Please try again.')
  return status
}
export function familyAccessRedirect(status:FamilyAccountAccess){return status.next==='AGE_CHECK'?'/age':status.next==='CHILD_PROFILE'?'/learner':null}
