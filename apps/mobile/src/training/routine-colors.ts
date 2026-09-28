import type { MobileRoutineColorKey } from '@/api/home';

const lightRoutineColors: Record<MobileRoutineColorKey, string> = {
  violet: '#7C3AED',
  indigo: '#4F46E5',
  blue: '#2563EB',
  cyan: '#0891B2',
  green: '#16A34A',
  yellow: '#CA8A04',
  orange: '#EA580C',
  rose: '#E11D48',
};

const darkRoutineColors: Record<MobileRoutineColorKey, string> = {
  violet: '#A78BFA',
  indigo: '#818CF8',
  blue: '#60A5FA',
  cyan: '#67E8F9',
  green: '#4ADE80',
  yellow: '#FACC15',
  orange: '#FB923C',
  rose: '#FB7185',
};

const routineColorLabels: Record<MobileRoutineColorKey, string> = {
  violet: 'violeta',
  indigo: 'índigo',
  blue: 'azul',
  cyan: 'celeste',
  green: 'verde',
  yellow: 'amarillo',
  orange: 'naranja',
  rose: 'rosa',
};

export function trainingRoutineColor(key: MobileRoutineColorKey, isDark: boolean): string {
  return (isDark ? darkRoutineColors : lightRoutineColors)[key];
}

export function trainingRoutineColorLabel(key: MobileRoutineColorKey): string {
  return routineColorLabels[key];
}

