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
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  // 已经登录的用户跑到登录页 → 直接弹回首页
  useEffect(() => {
    if (!authLoading && session) {
      router.replace('/')
    }
  }, [authLoading, session, router])

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
