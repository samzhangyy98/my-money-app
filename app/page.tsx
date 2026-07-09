'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '其他']

// 图表分类色：经 CVD（色觉障碍）与对比度校验的暖调色板，顺序即防混淆机制，勿随意调换
const CATEGORY_COLORS: Record<string, string> = {
  餐饮: '#B05C3E', // 陶土橙
  交通: '#6B73C1', // 长春花
  购物: '#55923D', // 苔绿
  娱乐: '#6A5DB3', // 紫罗兰
  其他: '#B3892F', // 赭金
}

// 同色系深色墨水：用于浅色底上的小字（对比度均 ≥5:1）
const CATEGORY_INK: Record<string, string> = {
  餐饮: '#8A4227',
  交通: '#4A5297',
  购物: '#3E6B2C',
  娱乐: '#4E4390',
  其他: '#77571A',
}

type Status = 'idle' | 'loading' | 'success' | 'error'

type Transaction = {
  id: number
  amount: number
  category: string
  note: string | null
  created_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── 图标组件 ──────────────────────────────────────────────
function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export default function Home() {
  // ── 认证状态 ──────────────────────────────────────────────
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // ── 新增表单状态 ──────────────────────────────────────────
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // ── 列表状态 ──────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [deleteError, setDeleteError] = useState('')

  // ── 编辑状态 ──────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', category: CATEGORIES[0], note: '' })
  const [editError, setEditError] = useState('')

  // ── 筛选状态（空数组 = 显示全部）────────────────────────────
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // ── 数据获取（只查当前用户自己的记录）──────────────────────
  async function fetchTransactions() {
    if (!user) return
    setListLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTransactions(data ?? [])
    setListLoading(false)
  }

  // ── 访问控制 + 首次加载 ────────────────────────────────────
  useEffect(() => {
    if (authLoading) return          // 会话还没查完，先等
    if (!user) {
      router.replace('/login')       // 未登录 → 踢去登录页
      return
    }
    fetchTransactions()              // 已登录 → 加载记账数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  // ── 登出 ──────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // ── 新增记录 ──────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase
      .from('transactions')
      .insert([{ amount: parseFloat(amount), category, note, user_id: user.id }])

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('success')
      setAmount('')
      setCategory(CATEGORIES[0])
      setNote('')
      fetchTransactions()
    }
  }

  // ── 删除记录 ──────────────────────────────────────────────
  async function handleDelete(id: number) {
    if (!user) return
    if (!window.confirm('确认删除这条记录？')) return
    setDeleteError('')

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setDeleteError(`删除失败：${error.message}`)
    } else {
      fetchTransactions()
    }
  }

  // ── 编辑记录 ──────────────────────────────────────────────
  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setEditForm({ amount: String(t.amount), category: t.category, note: t.note ?? '' })
    setEditError('')
  }

  async function handleEditSave() {
    if (editingId === null || !user) return
    setEditError('')

    const { error } = await supabase
      .from('transactions')
      .update({
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        note: editForm.note,
      })
      .eq('id', editingId)
      .eq('user_id', user.id)

    if (error) {
      setEditError(`保存失败：${error.message}`)
    } else {
      setEditingId(null)
      fetchTransactions()
    }
  }

  // ── 图表数据聚合（始终基于全量 transactions）────────────────
  const { pieData, barData, totalAmount, totalCount } = useMemo(() => {
    const categoryMap: Record<string, number> = {}
    for (const t of transactions) {
      categoryMap[t.category] = (categoryMap[t.category] ?? 0) + t.amount
    }
    const pieData = Object.entries(categoryMap).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }))

    const dailyMap: Record<string, number> = {}
    for (const t of transactions) {
      const date = t.created_at.slice(0, 10)
      dailyMap[date] = (dailyMap[date] ?? 0) + t.amount
    }
    const barData = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, total]) => ({ date: date.slice(5), total: parseFloat(total.toFixed(2)) }))

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)
    const totalCount = transactions.length

    return { pieData, barData, totalAmount, totalCount }
  }, [transactions])

  // ── 筛选后的列表（空选 = 全部）──────────────────────────────
  const filteredTransactions = selectedCategories.length === 0
    ? transactions
    : transactions.filter(t => selectedCategories.includes(t.category))

  // ── 渲染 ──────────────────────────────────────────────────
  // 会话未确定 / 未登录（即将跳转）时，先不渲染记账页，避免内容闪现
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex justify-center p-4 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* 顶部：当前用户 + 登出 */}
        <div className="flex items-center justify-between bg-surface rounded-2xl shadow-soft border border-border/60 px-5 py-3">
          <span className="text-sm text-muted truncate">
            👤 {user.email}
          </span>
          <button
            onClick={handleLogout}
            className="shrink-0 ml-3 px-3 py-1.5 bg-background hover:bg-border/60 text-muted text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            登出
          </button>
        </div>

        {/* 新增表单卡片 */}
        <div className="bg-surface rounded-2xl shadow-soft border border-border/60 p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">记一笔</h1>
          <p className="text-sm text-muted text-center mb-8">记录你的每一笔支出</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">金额（元）</label>
              <input
                type="number" min="0" step="0.01" required
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-border rounded-lg px-4 py-2.5 text-foreground placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-terracotta"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">分类</label>
              <select
                value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-terracotta"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">备注（可选）</label>
              <input
                type="text"
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="简单描述一下..."
                className="w-full border border-border rounded-lg px-4 py-2.5 text-foreground placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-terracotta"
              />
            </div>
            <button
              type="submit" disabled={status === 'loading'}
              className="w-full bg-accent-terracotta hover:bg-accent-terracotta-deep disabled:bg-accent-terracotta/50 text-white font-semibold rounded-lg py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {status === 'loading' ? '保存中...' : '保存'}
            </button>
          </form>

          {status === 'success' && (
            <div className="mt-5 p-3 bg-accent-sage-soft border border-[#C9D4B8] rounded-lg text-[#3E6B2C] text-sm text-center">
              ✅ 记录已保存！
            </div>
          )}
          {status === 'error' && (
            <div className="mt-5 p-3 bg-[#F7E4E0] border border-[#E8C8C0] rounded-lg text-[#A0392E] text-sm">
              ❌ 保存失败：{errorMsg}
            </div>
          )}
        </div>

        {/* 数据概览卡片 */}
        {!listLoading && totalCount > 0 && (
          <div className="bg-surface rounded-2xl shadow-soft border border-border/60 p-8 space-y-7">
            <h2 className="text-lg font-semibold text-foreground">数据概览</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-accent-terracotta-soft rounded-xl p-4 text-center">
                <p className="text-xs text-[#8A4227] font-medium mb-1">总支出</p>
                <p className="text-2xl font-bold text-foreground">¥{totalAmount.toFixed(2)}</p>
              </div>
              <div className="bg-accent-sage-soft rounded-xl p-4 text-center">
                <p className="text-xs text-[#3E6B2C] font-medium mb-1">总笔数</p>
                <p className="text-2xl font-bold text-foreground">{totalCount} 笔</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted mb-1">分类占比</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#B3892F'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`¥${Number(value).toFixed(2)}`, '金额']}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Legend iconType="circle" iconSize={8}
                    formatter={(value) => <span className="text-xs text-muted">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="text-sm font-medium text-muted mb-1">近期每日支出</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDE7DA" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B6455' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B6455' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [`¥${Number(value).toFixed(2)}`, '支出']}
                    cursor={{ fill: '#F0EADF' }}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' }}
                    labelStyle={{ color: 'var(--foreground)' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Bar dataKey="total" fill="#B05C3E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 历史记录卡片 */}
        <div className="bg-surface rounded-2xl shadow-soft border border-border/60 p-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">历史记录</h2>

          {/* 分类筛选标签 */}
          <div className="flex flex-wrap gap-2 mb-5">
            {/* 全部：清空已选 */}
            <button
              onClick={() => setSelectedCategories([])}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedCategories.length === 0
                  ? 'bg-foreground text-surface'
                  : 'bg-background text-muted hover:bg-border/60'
              }`}
            >
              全部
            </button>
            {/* 各分类：点击切换选中/取消 */}
            {CATEGORIES.map(cat => {
              const active = selectedCategories.includes(cat)
              return (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategories(prev =>
                      active ? prev.filter(c => c !== cat) : [...prev, cat]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'ring-1 ring-current'
                      : 'bg-background text-muted hover:bg-border/60'
                  }`}
                  style={active ? { backgroundColor: `${CATEGORY_COLORS[cat]}20`, color: CATEGORY_INK[cat] } : undefined}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {deleteError && (
            <div className="mb-4 p-3 bg-[#F7E4E0] border border-[#E8C8C0] rounded-lg text-[#A0392E] text-sm">
              ❌ {deleteError}
            </div>
          )}

          {listLoading ? (
            <p className="text-sm text-muted text-center py-6">加载中...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">还没有记录，记一笔吧 ✏️</p>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">该分类暂无记录</p>
          ) : (
            <ul className="space-y-1">
              {filteredTransactions.map(t => (
                editingId === t.id ? (
                  /* ── 编辑模式 ── */
                  <li key={t.id} className="py-4 border-b border-border/50 last:border-0 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="number" min="0" step="0.01" required
                        value={editForm.amount}
                        onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-28 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-terracotta"
                      />
                      <select
                        value={editForm.category}
                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                        className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-terracotta"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={editForm.note}
                      onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                      placeholder="备注（可选）"
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-terracotta"
                    />
                    {editError && (
                      <p className="text-xs text-[#A0392E]">{editError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditSave}
                        className="px-4 py-1.5 bg-accent-terracotta hover:bg-accent-terracotta-deep text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 bg-background hover:bg-border/60 text-muted text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  </li>
                ) : (
                  /* ── 正常显示模式 ── */
                  <li
                    key={t.id}
                    className="group flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: `${CATEGORY_COLORS[t.category] ?? '#B3892F'}20`,
                            color: CATEGORY_INK[t.category] ?? '#77571A',
                          }}
                        >
                          {t.category}
                        </span>
                        {t.note && (
                          <span className="text-sm text-muted truncate">{t.note}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{formatDate(t.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className="text-base font-semibold text-foreground">
                        ¥{t.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => startEdit(t)}
                        className="opacity-0 group-hover:opacity-100 text-muted/40 hover:text-accent-terracotta transition-opacity cursor-pointer"
                        title="编辑"
                      >
                        <IconPencil />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted/40 hover:text-[#A0392E] transition-opacity cursor-pointer"
                        title="删除"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </li>
                )
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
