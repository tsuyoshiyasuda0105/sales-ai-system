import Link from "next/link";
import { navSections } from "@/lib/navigation";
import { Icon } from "@/components/icons";

type AppShellProps = {
  active: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ active, title, subtitle, actions, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">S</span>
          <span className="brand-text">
            <span className="sidebar-title">Sedori AI</span>
            <span className="brand-sub">SOURCING OPS</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="メインナビゲーション">
          {navSections.map((section) => (
            <div key={section.title} className="nav-group">
              <div className="sidebar-section">{section.title}</div>
              {section.items.map((item) => (
                <Link
                  className={`sidebar-link ${item.label === active ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                  aria-current={item.label === active ? "page" : undefined}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          <div className="topbar-actions">
            {actions}
            <button className="org-pill" type="button">
              Demo Store
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
