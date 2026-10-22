import { Menu } from 'lucide-react'
import { SkeletonRows } from '@/components/skeleton'
import { TYPE_LABEL, initials, personLabel, tone } from '@/lib/constants'
import type { Profile } from '@/lib/types'

export function DashboardSkeleton({ profile, rows = 3 }: { profile: Profile; rows?: number }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><img className="brand-seal" src="/seal.png" alt="" width={38} height={38} /><div><p className="brand-name">SPCC</p><p className="brand-subtitle">Caloocan campus</p></div></div>
      <nav className="main-nav" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <span className="skeleton skeleton-nav" key={i} />)}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-card">
          <div className="user-card-top"><span className={`avatar avatar-${tone(profile.full_name.length)}`}>{profile.full_name.trim() ? initials(profile.full_name) : profile.email.slice(0, 1).toUpperCase()}</span><div><strong>{personLabel(profile.full_name) || profile.email}</strong>{personLabel(profile.full_name) ? <small>{profile.email}</small> : null}</div></div>
          <span className="user-card-role">{TYPE_LABEL[profile.role] ?? profile.role}</span>
        </div>
        <span className="skeleton skeleton-signout" aria-hidden="true" />
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="icon-button mobile-menu" aria-hidden="true" tabIndex={-1}><Menu /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Loading…</strong></div></header>
      <div className="content-wrap">
        <section className="page-intro"><div><span className="skeleton skeleton-title" /><span className="skeleton skeleton-line skeleton-intro" /></div></section>
        <section className="metric-grid">{Array.from({ length: 4 }, (_, i) => <span className="skeleton skeleton-card" key={i} aria-hidden="true" />)}</section>
        <div className="panel"><SkeletonRows rows={rows} label="Loading your workspace" /></div>
      </div>
    </main>
  </div>
}
