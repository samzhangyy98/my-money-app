'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  // 已经登录的用户跑到登录页 → 直接弹回首页
  useEffect(() => {
    if (!authLoading && session) {
      router.replace('/')
    }
  }, [authLoading, session, router])

  // 从 Google 授权页点"后退"回来时，浏览器会从往返缓存（bfcache）原样恢复页面，
  // googleLoading 还停留在 true。监听 pageshow 的 persisted 标记，恢复时重置按钮。
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) setGoogleLoading(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  function switchMode(next: Mode) {
    setMode(next)
    setErrorMsg('')
    setInfoMsg('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setInfoMsg('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg(error.message)
        setSubmitting(false)
        return
      }
      // 登录成功：AuthProvider 会收到通知，这里直接跳回首页
      router.replace('/')
      return
    }

    // 注册
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setErrorMsg(error.message)
      setSubmitting(false)
      return
    }

    if (data.session) {
      // 后台已关闭"邮箱验证" → 注册即登录，直接进首页
      router.replace('/')
    } else {
      // 后台仍开启"邮箱验证" → 没有会话，需要去邮箱点确认链接
      setInfoMsg('注册成功！请到邮箱点击确认链接后再登录（或在 Supabase 后台关闭邮箱验证以跳过此步）。')
      setMode('login')
      setSubmitting(false)
    }
  }

  // Google 登录：跳去 Google 授权，成功后 Supabase 把浏览器送回 /auth/callback
  async function handleGoogleLogin() {
    setErrorMsg('')
    setInfoMsg('')
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // 成功时浏览器会直接跳走，走不到这里；能走到说明出错了
    if (error) {
      setErrorMsg(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">
          {mode === 'login' ? '登录' : '注册'}
        </h1>
        <p className="text-sm text-gray-400 text-center mb-8">
          {mode === 'login' ? '欢迎回来，继续记账' : '创建账号,开始记账'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password" required minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit" disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {/* 分隔线：或 */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">或</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Google 登录按钮 */}
        <button
          type="button" onClick={handleGoogleLogin} disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-medium rounded-lg py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {googleLoading ? '跳转中...' : '用 Google 登录'}
        </button>

        {errorMsg && (
          <div className="mt-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ❌ {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="mt-5 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✅ {infoMsg}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? '还没有账号？' : '已经有账号了？'}
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="ml-1 text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
          >
            {mode === 'login' ? '去注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
