'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

/**
 * OAuth 回调页：Google 授权完成后，Supabase 把浏览器送回这里，
 * URL 里带着登录凭证。supabase-js 加载时会自动解析凭证并存好 session
 * （detectSessionInUrl，默认开启），AuthProvider 随之更新。
 * 本页只做三件事：等待、成功跳首页、失败给出提示。
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const [errorMsg, setErrorMsg] = useState('')

  // 如果 Google/Supabase 带回了错误（比如用户点了取消），错误信息在 URL 里
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const queryParams = new URLSearchParams(window.location.search)
    const desc =
      hashParams.get('error_description') ?? queryParams.get('error_description') ??
      hashParams.get('error') ?? queryParams.get('error')
    if (desc) setErrorMsg(desc)
  }, [])

  useEffect(() => {
    if (loading || errorMsg) return
    // session 出现 → 登录成功回首页；始终没出现 → 回登录页
    router.replace(session ? '/' : '/login')
  }, [loading, session, errorMsg, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {errorMsg ? (
        <div className="w-full max-w-sm bg-surface rounded-2xl shadow-soft border border-border/60 p-8 text-center space-y-4">
          <p className="text-sm text-[#A0392E]">❌ 登录失败：{errorMsg}</p>
          <Link href="/login" className="inline-block text-sm text-accent-terracotta-deep hover:underline font-medium">
            返回登录页
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted">登录中...</p>
      )}
    </div>
  )
}
