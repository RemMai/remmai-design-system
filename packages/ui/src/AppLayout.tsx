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

/**
 * RMDL Admin Layout 外壳
 * 约束：
 * 1. 顶栏 topbar 和左侧 sidebar 视口绝对固定，不跟随滚动
 * 2. 右侧 content 区域高度溢出时独立滚动
 * 3. userProfile 用户信息区强制沉底吸附在 Menu 侧边栏最下方
 */
export function AppShell({
  appName,
  navigation,
  topbar,
  userProfile,
  children,
}: {
  appName: string;
  navigation: readonly RmdlNavItem[];
  topbar: ReactNode;
  userProfile?: ReactNode;
  children: ReactNode;
}) {
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
        <div className="rmdl-shell__nav-wrapper">
          {menu('rmdl-nav rmdl-nav--desktop', '主导航')}
        </div>
        {userProfile ? (
          <div className="rmdl-shell__user">
            {userProfile}
          </div>
        ) : null}
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
  return <div className="rmdl-toolbar">{children}</div>;
}

export function AppSection({title, children}: {title: string; children: ReactNode}) {
  return (
    <section className="rmdl-section">
      <h2 className="rmdl-section__title">{title}</h2>
      {children}
    </section>
  );
}

export function AppEmptyState({
  title, description, action,
}: {title: string; description: string; action?: {label: string; onClick: () => void}}) {
  return (
    <div className="rmdl-empty">
      <div className="rmdl-empty__title">{title}</div>
      <p className="rmdl-empty__description">{description}</p>
      {action ? (
        <div>
          <Button variant="primary" size="sm" onClick={action.onClick}>{action.label}</Button>
        </div>
      ) : null}
    </div>
  );
}

/** HeroUI v3 button contract; variants should be governed centrally. */
export function AppButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} />;
}
