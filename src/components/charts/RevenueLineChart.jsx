import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../common/EmptyState'

const RANGES = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: 'year', label: 'Year', days: 0 },
]

const dayLabel = (date) => date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
const monthLabel = (date) => date.toLocaleDateString('en-US', { month: 'short' })

function buildDailySeries(orders, days, offset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  today.setDate(today.getDate() - offset * days)
  const buckets = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    buckets.push({ key: date.toDateString(), label: dayLabel(date), revenue: 0 })
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  orders.forEach((order) => {
    const date = order.date ? new Date(order.date) : null
    if (!date || Number.isNaN(date.getTime())) return
    const bucket = byKey.get(date.toDateString())
    if (bucket) bucket.revenue += Number(order.total || 0)
  })
  return buckets
}

function buildYearlySeries(orders, offset) {
  const now = new Date()
  const endMonth = now.getMonth() - offset * 12
  const buckets = []
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), endMonth - i, 1)
    buckets.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: monthLabel(date), revenue: 0 })
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  orders.forEach((order) => {
    const date = order.date ? new Date(order.date) : null
    if (!date || Number.isNaN(date.getTime())) return
    const bucket = byKey.get(`${date.getFullYear()}-${date.getMonth()}`)
    if (bucket) bucket.revenue += Number(order.total || 0)
  })
  return buckets
}

function mostRecentOrderDate(orders) {
  return orders.reduce((latest, order) => {
    const date = order.date ? new Date(order.date) : null
    if (!date || Number.isNaN(date.getTime())) return latest
    return !latest || date > latest ? date : latest
  }, null)
}

function pickInitialWindow(orders) {
  const mostRecent = mostRecentOrderDate(orders)
  if (!mostRecent) return { range: '7d', offset: 0 }
  const now = new Date()
  const daysAgo = Math.floor((now - mostRecent) / 86400000)
  if (daysAgo <= 6) return { range: '7d', offset: 0 }
  if (daysAgo <= 29) return { range: '30d', offset: 0 }
  const monthsAgo = (now.getFullYear() - mostRecent.getFullYear()) * 12 + (now.getMonth() - mostRecent.getMonth())
  if (monthsAgo <= 11) return { range: 'year', offset: 0 }
  return { range: 'year', offset: Math.floor(monthsAgo / 12) }
}

export default function RevenueLineChart({ orders = [] }) {
  const [range, setRange] = useState('7d')
  const [offset, setOffset] = useState(0)
  const autoPicked = useRef(false)

  useEffect(() => {
    if (autoPicked.current || orders.length === 0) return
    autoPicked.current = true
    const initial = pickInitialWindow(orders)
    setRange(initial.range)
    setOffset(initial.offset)
  }, [orders])

  const selectedRange = RANGES.find((item) => item.key === range)
  const data = useMemo(() => (
    range === 'year' ? buildYearlySeries(orders, offset) : buildDailySeries(orders, selectedRange.days, offset)
  ), [orders, range, offset, selectedRange])

  const hasRevenue = data.some((point) => point.revenue > 0)

  const changeRange = (key) => { setRange(key); setOffset(0) }

  return <section className="surface-panel revenue-panel">
    <div className="section-heading">
      <div><p className="eyebrow">REVENUE &amp; SALES</p><h2>Revenue &amp; Sales Chart</h2><p className="categories-subtitle">Track sales and order performance over time</p></div>
      <div className="revenue-range-tabs">
        {RANGES.map((item) => <button type="button" key={item.key} className={item.key === range ? 'active' : ''} onClick={() => changeRange(item.key)}>{item.label}</button>)}
      </div>
    </div>
    {hasRevenue ? <div className="revenue-chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f59e0b" opacity={0.12} vertical={false} />
            <XAxis dataKey="label" stroke="#c3c7cd" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#c3c7cd" fontSize={12} tickLine={false} axisLine={false} width={56} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
              contentStyle={{ background: '#171a1e', border: '1px solid #292e35', borderRadius: 10, color: '#f2f2f3' }}
              labelStyle={{ color: '#9ba0aa' }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} fill="url(#revenueFill)" dot={false} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div> : <EmptyState title="No revenue in this period" message={orders.length ? 'Try a different date range to see other periods.' : 'Orders placed in this window will appear here.'} />}
  </section>
}
