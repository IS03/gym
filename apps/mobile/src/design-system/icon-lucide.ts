import {
  BookOpen, Calendar, ChartLine, ChevronDown,
  ChevronLeft, ChevronRight, CircleCheck, ClipboardList, Clock, Coffee, Droplet, Dumbbell, Ellipsis, Flame,
  Footprints, ListFilter, Moon, NotebookPen, Play, Plus, RotateCw, Settings, TriangleAlert, Trophy, User, Utensils, Weight, X, Zap, type LucideIcon,
} from 'lucide-react-native';

import type { AppIconName } from './icon-names';

// Android/Web icon set per IDENTIDAD.md (Lucide, stroke 2). Imported only by icons.android.tsx.
export const lucideIcons: Record<AppIconName, LucideIcon> = {
  activity: Zap,
  // Temporary until the brand isotype replaces it (M9.1D).
  brand: Dumbbell,
  book: BookOpen,
  calendar: Calendar,
  check: CircleCheck,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clock: Clock,
  close: X,
  dumbbell: Dumbbell,
  flame: Flame,
  filter: ListFilter,
  footprints: Footprints,
  more: Ellipsis,
  moon: Moon,
  mug: Coffee,
  nutrition: Utensils,
  note: NotebookPen,
  plus: Plus,
  play: Play,
  profile: User,
  progress: ChartLine,
  refresh: RotateCw,
  routines: ClipboardList,
  scale: Weight,
  settings: Settings,
  trophy: Trophy,
  warning: TriangleAlert,
  water: Droplet,
};

export const LUCIDE_STROKE_WIDTH = 2;
