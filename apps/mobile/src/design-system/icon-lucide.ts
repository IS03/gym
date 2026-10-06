import {
  Calendar, ChartLine, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, Clock, Droplet, Dumbbell, Flame,
  ListFilter, NotebookPen, RotateCw, Settings, TriangleAlert, User, Utensils, X, Zap, type LucideIcon,
} from 'lucide-react-native';

import type { AppIconName } from './icon-names';

// Android/Web icon set per IDENTIDAD.md (Lucide, stroke 2). Imported only by icons.android.tsx.
export const lucideIcons: Record<AppIconName, LucideIcon> = {
  activity: Zap,
  // Temporary until the brand isotype replaces it (M9.1D).
  brand: Dumbbell,
  calendar: Calendar,
  check: CircleCheck,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clock: Clock,
  close: X,
  dumbbell: Dumbbell,
  flame: Flame,
  filter: ListFilter,
  nutrition: Utensils,
  note: NotebookPen,
  profile: User,
  progress: ChartLine,
  refresh: RotateCw,
  routines: ClipboardList,
  settings: Settings,
  warning: TriangleAlert,
  water: Droplet,
};

export const LUCIDE_STROKE_WIDTH = 2;
