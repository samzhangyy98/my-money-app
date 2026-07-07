-- ============================================================
-- transactions 表的数据隔离：RLS（行级安全）
-- 在 Supabase 后台 → SQL Editor 中执行
-- ============================================================

-- 1) 开启 RLS：从此以后，任何人访问这张表，每一行都要经过策略检查。
--    注意：刚开启且没有任何策略时，默认是"全部拒绝"。
alter table public.transactions enable row level security;

-- 2) 查询策略：登录用户只能"看到"user_id 等于自己 id 的行
create policy "Users can view own transactions"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

-- 3) 插入策略：登录用户只能插入 user_id 等于自己 id 的行
--    （with check = 对"即将写入的新行"做检查，防止冒充别人写数据）
create policy "Users can insert own transactions"
on public.transactions
for insert
to authenticated
with check (auth.uid() = user_id);

-- 4) 更新策略：只能改自己的行（using），且改完后仍必须是自己的行（with check），
--    防止把自己的记录"转让"给别人。
create policy "Users can update own transactions"
on public.transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 5) 删除策略：只能删自己的行
create policy "Users can delete own transactions"
on public.transactions
for delete
to authenticated
using (auth.uid() = user_id);
