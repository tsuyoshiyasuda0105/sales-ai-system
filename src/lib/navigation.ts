import type { IconName } from "@/components/icons";

export const demoOrganizationId = "demo";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "概要",
    items: [{ label: "ダッシュボード", href: "/", icon: "dashboard" }]
  },
  {
    title: "仕入れ判断",
    items: [
      { label: "横断比較", href: "/cross-platform", icon: "compare" },
      { label: "価格差チャンス", href: "/opportunities", icon: "opportunity" },
      { label: "トレンド", href: "/trending", icon: "spark" },
      { label: "商品/AI判定", href: "/products", icon: "product" }
    ]
  },
  {
    title: "在庫・販売",
    items: [
      { label: "仕入れ", href: "/purchases", icon: "purchase" },
      { label: "在庫", href: "/inventory", icon: "inventory" },
      { label: "注文", href: "/orders", icon: "order" }
    ]
  },
  {
    title: "経営・管理",
    items: [
      { label: "会計", href: "/accounting", icon: "accounting" },
      { label: "ジョブ", href: "/jobs", icon: "jobs" },
      { label: "API設定", href: "/settings/api", icon: "api" },
      { label: "利用量/課金", href: "/billing", icon: "billing" },
      { label: "監査ログ", href: "/security", icon: "audit" }
    ]
  }
];

// Flat list kept for backwards compatibility.
export const navItems: NavItem[] = navSections.flatMap((section) => section.items);
