import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({fetch:vi.fn(),session:vi.fn()}))
vi.mock('next-auth/react',()=>({getSession:mocks.session}))
vi.mock('@/lib/api/platform-client',()=>({platformApiBaseUrl:()=> 'https://platform.test/api/v1'}))
import {familyRequest,FamilyError} from '@/lib/api/family'
import {familyBrowserRequest,familyDeviceRequest} from '@/lib/api/family-browser'
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status})
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',mocks.fetch);mocks.session.mockResolvedValue({accessToken:'fresh-adult',user:{id:'adult-a'}});mocks.fetch.mockResolvedValue(response({data:{id:'verified'}}))})
afterEach(()=>vi.unstubAllGlobals())
describe('B03 family transport authority',()=>{
 it('requires bearer authority before dispatch',async()=>{await expect(familyRequest('','/family/children')).rejects.toMatchObject({status:401});expect(mocks.fetch).not.toHaveBeenCalled()})
 it('uses canonical v1 no-store bounded requests and the existing envelope',async()=>{expect(await familyRequest('adult','/family/children')).toEqual({id:'verified'});expect(mocks.fetch).toHaveBeenCalledWith('https://platform.test/api/v1/family/children',expect.objectContaining({cache:'no-store',headers:{Authorization:'Bearer adult','Content-Type':'application/json'},signal:expect.any(AbortSignal)}))})
 it('supports compatible PUT restrictions without a new API major',async()=>{await familyRequest('adult','/family/profiles/profile-a/preferences','PUT',{expectedRevision:2});expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/family/profiles/'),expect.objectContaining({method:'PUT',body:'{"expectedRevision":2}'}))})
 it('resolves the fresh verified session for every browser operation',async()=>{await familyBrowserRequest('/family/children');mocks.session.mockResolvedValue({accessToken:'next-adult',user:{id:'adult-a'}});await familyBrowserRequest('/family/children');expect(mocks.session).toHaveBeenCalledTimes(2);expect(mocks.fetch.mock.calls[1]?.[1]?.headers.Authorization).toBe('Bearer next-adult')})
 it('blocks browser dispatch after missing identity',async()=>{mocks.session.mockResolvedValue({accessToken:'token',user:{id:''}});await expect(familyBrowserRequest('/family/children')).rejects.toMatchObject({status:401});expect(mocks.fetch).not.toHaveBeenCalled()})
 it('preserves a safe session-check outage without dispatch',async()=>{mocks.session.mockRejectedValue(new Error('private details'));await expect(familyBrowserRequest('/family/children')).rejects.toThrow('session could not be checked');expect(mocks.fetch).not.toHaveBeenCalled()})
 it('does not replay mutations after failed response or timeout',async()=>{mocks.fetch.mockRejectedValue(new Error('private host'));await expect(familyBrowserRequest('/family/handoffs','POST',{email:'private@example.test'})).rejects.toThrow('entries are still here');expect(mocks.fetch).toHaveBeenCalledTimes(1)})
 it('keeps server PIN lockout code without leaking arbitrary server text',async()=>{mocks.fetch.mockResolvedValue(response({message:'secret hash',code:'PIN_HELP_REQUIRED'},429));await expect(familyDeviceRequest('profiles/p/unlock','POST',{pictures:[0,5,7]})).rejects.toMatchObject({code:'PIN_HELP_REQUIRED',status:429});expect(mocks.fetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization')})
 it('limits device browser calls to the same-origin BFF and never uses adult bearer',async()=>{await familyDeviceRequest('profiles');expect(mocks.fetch).toHaveBeenCalledWith('/api/family-access/profiles',expect.objectContaining({method:'GET',cache:'no-store'}));expect(mocks.session).not.toHaveBeenCalled()})
 it.each([400,401,403,409,503])('hides unknown server details for status %s',async(status)=>{mocks.fetch.mockResolvedValue(response({message:'credential-and-private-record'},status));try{await familyRequest('adult','/family/children');throw new Error('expected rejection')}catch(error){expect(error).toBeInstanceOf(FamilyError);expect((error as Error).message).not.toContain('credential-and-private-record');expect(error).toMatchObject({status})}})
})
