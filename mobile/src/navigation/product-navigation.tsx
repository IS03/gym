import type { ComponentType } from "react";
import {
  ChartNoAxesCombined,
  Dumbbell,
  House,
  Utensils,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { native } from "../native/bridge";
import {
  activeProductTab,
  PRODUCT_TABS,
  type ProductTabId,
} from "./routes";

const icons: Record<ProductTabId, ComponentType<{ size?: number }>> = {
  home: House,
  train: Dumbbell,
  nutrition: Utensils,
  progress: ChartNoAxesCombined,
};

export function ProductNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = activeProductTab(location.pathname);

  function selectTab(path: (typeof PRODUCT_TABS)[number]["path"]) {
    if (location.pathname === path) return;
    void native.haptics.selection();
    navigate(path, { replace: true });
  }

  return (
    <nav className="product-navigation" aria-label="Navegación principal">
      <div className="product-navigation-inner">
        {PRODUCT_TABS.map(({ id, label, path }) => {
          const Icon = icons[id];
          const active = activeTab === id;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className="product-nav-item"
              key={id}
              onClick={() => selectTab(path)}
              type="button"
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
