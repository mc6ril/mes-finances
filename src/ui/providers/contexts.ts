import { createContext } from 'react';
import type { Container } from '@/app/container';
import type { MonthKey } from '@/core/shared/model';

export type PeriodValue = {
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
  today: string;
  currentMonth: MonthKey;
};

export type ToastTone = 'success' | 'error' | 'info';

export type Toast = { id: number; tone: ToastTone; message: string };

export type ToastValue = {
  toasts: Toast[];
  notify: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
};

export const ContainerContext = createContext<Container | null>(null);

export const PeriodContext = createContext<PeriodValue | null>(null);

export const ToastContext = createContext<ToastValue | null>(null);
