// Warm every authenticated route the B03 review visits so a first-time Next dev compilation cannot rewrite
// shared dev chunks while a counted browser case is loading them. This is not a test and proves nothing.
import {chromium} from '@playwright/test'
const base='http://localhost:3101'
const password='B03Review!Pass2026'
const health=await (await fetch('http://127.0.0.1:3102/api/v1/review-health')).json()
const school=health.data.schools.find(item=>item.name==='Review School A').id
const plan={
 admin:['/workspaces',`/org/${school}/academics`,`/org/${school}/students`,`/org/${school}/policies`],
 parent:['/consent','/age','/profiles','/family','/learner','/student-invite'],
 student:['/age','/consent','/profiles','/learner'],
 teeninvite:['/student-invite','/learner','/profiles'],
 outsider:['/age'],
}
const browser=await chromium.launch()
for(const [name,paths] of Object.entries(plan)){
 const context=await browser.newContext()
 const page=await context.newPage()
 await page.goto(`${base}/login?callbackUrl=${encodeURIComponent(paths[0])}`)
 const button=page.getByRole('button',{name:'Log in',exact:true})
 await button.waitFor({state:'visible'})
 for(let i=0;i<120&&!await button.isEnabled();i++)await page.waitForTimeout(500)
 await page.getByLabel('Email',{exact:true}).fill(`${name}@b03.example.test`)
 await page.getByLabel('Password',{exact:true}).fill(password)
 await button.click()
 await page.waitForURL(url=>!url.pathname.startsWith('/login'),{timeout:120000})
 if(name==='admin'){
  await page.getByRole('heading',{name:'Review School A',exact:true}).locator('..').getByRole('button',{name:'Open workspace',exact:true}).click()
  await page.waitForURL(new RegExp(`/org/${school}/academics$`),{timeout:120000})
 }
 for(const path of paths){const started=Date.now();const response=await page.goto(`${base}${path}`,{timeout:240000,waitUntil:'load'});await page.waitForTimeout(1500);console.log(name,path,response?.status(),`${Date.now()-started}ms`,page.url().replace(base,''))}
 await context.close()
}
await browser.close()
