'use client'
import { useEffect, useState } from 'react'
/** One-use mail credentials are read from a fragment, then removed from browser history. */
export function useFragmentCode(name: string) {
  const [code,setCode]=useState('')
  useEffect(()=>{const params=new URLSearchParams(window.location.hash.slice(1));const value=params.get(name);if(value){setCode(value);window.history.replaceState(null,'',`${window.location.pathname}${window.location.search}`)}},[name])
  return [code,setCode] as const
}
