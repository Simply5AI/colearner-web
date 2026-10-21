import {defineConfig} from '@playwright/test'
import path from 'node:path'
const artifacts=process.env.B03_REVIEW_OUTPUT_DIR?path.resolve(process.env.B03_REVIEW_OUTPUT_DIR,'failure-artifacts'):'../../../output/playwright/b03/failure-artifacts'
export default defineConfig({testDir:'.',testMatch:'family-review.spec.ts',timeout:150000,expect:{timeout:25000},workers:1,retries:0,reporter:[['list']],use:{baseURL:'http://localhost:3101',browserName:'chromium',actionTimeout:30000,trace:'retain-on-failure',screenshot:'only-on-failure'},outputDir:artifacts})
