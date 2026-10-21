import {beforeEach,describe,it,expect,vi} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
const mocks=vi.hoisted(()=>({auth:vi.fn(),request:vi.fn(),school:vi.fn()}))
vi.mock('@/lib/auth/config',()=>({auth:mocks.auth}))
vi.mock('@/lib/api/family',async()=>{const actual=await vi.importActual<typeof import('@/lib/api/family')>('@/lib/api/family');return {...actual,familyRequest:mocks.request}})
vi.mock('@/lib/api/school',()=>({schoolRequest:mocks.school}))
vi.mock('next/navigation',()=>({redirect:(href:string)=>{throw new Error(`REDIRECT:${href}`)},useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/components/shared/AppSidebar',()=>({StudentShell:({children}:{children:React.ReactNode})=><>{children}</>}))
vi.mock('@/components/shared/global-gamification-events',()=>({GlobalGamificationEvents:()=>null}))
import OnboardingLayout from '@/app/(onboarding)/layout'
import DashboardLayout from '@/app/(dashboard)/layout'
import HomePage from '@/app/page'
import {accountFamilyAccess} from '@/lib/auth/family-access'
import {googleIdentityOnly} from '@/lib/auth/google-identity'
const content=<form aria-label="Legacy identity form"><input aria-label="Legacy name"/></form>
beforeEach(()=>{cleanup();vi.clearAllMocks();mocks.auth.mockResolvedValue({accessToken:'verified-account',user:{id:'account-a',onboardingCompleted:true,roles:[]}});mocks.school.mockResolvedValue({items:[]});mocks.request.mockResolvedValue({next:'ADULT_ONBOARDING',ageBand:'ADULT'})})
describe('B03 server entry gates before legacy identity collection',()=>{
 it('requires actual authentication before any legacy onboarding content',async()=>{mocks.auth.mockResolvedValue(null);await expect(OnboardingLayout({children:content})).rejects.toThrow('REDIRECT:/login');expect(mocks.request).not.toHaveBeenCalled()})
 it.each([null,'UNDER_6','KIDS','TWEENS','TEENS'])('redirects unresolved/minor band %s before rendering name or school forms',async(ageBand)=>{mocks.request.mockResolvedValue({next:'AGE_CHECK',ageBand});await expect(OnboardingLayout({children:content})).rejects.toThrow('REDIRECT:/age');expect(screen.queryByLabelText('Legacy name')).not.toBeInTheDocument()})
 it('routes an actually consented own school profile to the scoped entry',async()=>{mocks.request.mockResolvedValue({next:'CHILD_PROFILE',ageBand:'TEENS'});await expect(OnboardingLayout({children:content})).rejects.toThrow('REDIRECT:/learner')})
 it('allows legacy onboarding only after an authoritative adult decision',async()=>{render(await OnboardingLayout({children:content}));expect(screen.getByLabelText('Legacy name')).toBeInTheDocument();expect(mocks.request).toHaveBeenCalledWith('verified-account','/family/access-status')})
 it('shows unavailable and no form when the age/consent service fails',async()=>{mocks.request.mockRejectedValue(new Error('service unavailable'));render(await OnboardingLayout({children:content}));expect(screen.getByRole('heading',{name:'Account access unavailable'})).toBeInTheDocument();expect(screen.queryByLabelText('Legacy name')).not.toBeInTheDocument()})
 it('rejects malformed or contradictory adult allowance instead of falling through',async()=>{mocks.request.mockResolvedValue({next:'ADULT_ONBOARDING',ageBand:null});await expect(accountFamilyAccess('account')).rejects.toThrow('access could not be checked');mocks.request.mockResolvedValue({next:'unexpected',ageBand:'ADULT'});await expect(accountFamilyAccess('account')).rejects.toThrow('access could not be checked')})
 it('does not let old onboarding-completed claims bypass the same dashboard gate',async()=>{mocks.request.mockResolvedValue({next:'AGE_CHECK',ageBand:'TEENS'});await expect(DashboardLayout({children:content})).rejects.toThrow('REDIRECT:/age')})
 it('root sends unknown accounts to DOB-only check before legacy onboarding',async()=>{mocks.request.mockResolvedValue({next:'AGE_CHECK',ageBand:null});await expect(HomePage()).rejects.toThrow('REDIRECT:/age')})
 it('root sends actual child profiles to scoped entry',async()=>{mocks.request.mockResolvedValue({next:'CHILD_PROFILE',ageBand:'KIDS'});await expect(HomePage()).rejects.toThrow('REDIRECT:/learner')})
 it('preserves verified school staff workspace without granting personal adult status',async()=>{mocks.school.mockResolvedValue({items:[{role:'SCHOOL_ADMIN',status:'ACTIVE'}]});await expect(HomePage()).rejects.toThrow('REDIRECT:/workspaces');expect(mocks.request).not.toHaveBeenCalled()})
 it('preserves dedicated platform administration and teacher routes',async()=>{mocks.auth.mockResolvedValue({accessToken:'verified',user:{id:'admin',systemRole:'SUPER_ADMIN'}});await expect(HomePage()).rejects.toThrow('REDIRECT:/admin/login');expect(mocks.request).not.toHaveBeenCalled();mocks.auth.mockResolvedValue({accessToken:'verified',user:{id:'teacher',roles:['TEACHER']}});await expect(OnboardingLayout({children:content})).rejects.toThrow('REDIRECT:/teacher/dashboard')})
 it('does not copy provider display name or photo before a verified application profile',()=>{const provider={sub:'provider-id',email:'learner@example.test',name:'Child legal name',picture:'https://provider.example.test/child-photo'};expect(googleIdentityOnly(provider)).toEqual({id:'provider-id',email:'learner@example.test',name:null,image:null})})
})
