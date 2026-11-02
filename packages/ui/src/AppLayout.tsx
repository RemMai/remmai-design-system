import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import './rmdl-layout.css';

/**
 * Fixed layout foundation shared across RMDL products.
 * This starter defines the page skeleton; full Table/Form/Dialog
 * primitives must be built in the published UI package, not in apps.
 */
export type RmdlNavItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  icon?: ReactNode;
};

/** Sidebar and mobile navigation are rendered from the same sanitized menu items. */
export function AppShell({
  appName, navigation, topbar, children,
}: {appName: string; navigation: readonly RmdlNavItem[]; topbar: ReactNode; children: ReactNode}) {
  const menu = (className: string, label: string) => (
    <nav className={className} aria-label={label}>
      {navigation.map(item => (
        <a
          key={item.id}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={'rmdl-nav__link' + (item.active ? ' rmdl-nav__link--active' : '')}
        >
          {item.icon ? <span aria-hidden="true" className="rmdl-nav__icon">{item.icon}</span> : null}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
  return (
    <div className="rmdl-shell">
      <aside className="rmdl-shell__sidebar" aria-label="侧边栏">
        <div className="rmdl-shell__brand">{appName}</div>
        {menu('rmdl-nav rmdl-nav--desktop', '主导航')}
      </aside>
      <div className="rmdl-shell__main">
        <header className="rmdl-shell__topbar">{topbar}</header>
        {menu('rmdl-nav rmdl-nav--mobile', '移动端主导航')}
        <main className="rmdl-shell__content">{children}</main>
      </div>
    </div>
  );
}

export function AppPage({children}: {children: ReactNode}) {
  return <div className="rmdl-page">{children}</div>;
}

export function AppPageHeader({
  title, description, action,
}: {title: string; description?: string; action?: ReactNode}) {
  return (
    <div className="rmdl-page-header">
      <div className="rmdl-page-header__copy">
        <h1 className="rmdl-page-header__title">{title}</h1>
        {description ? <p className="rmdl-page-header__description">{description}</p> : null}
      </div>
      {action ? <div className="rmdl-page-header__action">{action}</div> : null}
    </div>
  );
}

export function AppToolbar({children}: {children: ReactNode}) {
  return <div className="rmdl-toolbar" role="group" aria-label="页面工具栏">{children}</div>;
}

export function AppSection({title, children}: {title?: string; children: ReactNode}) {
  return (
    <section className="rmdl-section">
      {title ? <h2 className="rmdl-section__title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function AppEmptyState({title, description}: {title: string; description?: string}) {
  return (
    <div className="rmdl-empty" role="status">
      <div className="rmdl-empty__title">{title}</div>
      {description ? <p className="rmdl-empty__description">{description}</p> : null}
    </div>
  );
}

/** HeroUI v3 button contract; variants should be governed centrally. */
export function AppButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} />;
}
