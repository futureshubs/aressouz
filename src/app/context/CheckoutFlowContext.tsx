import { createContext, useContext, type ReactNode } from 'react';

export type CheckoutFlowContextValue = {
  /** Barcha bo‘limlardan: tekshiruvlar → (ijara bo‘lsa shartlar) → Checkout.tsx */
  openCheckoutFlow: () => void;
};

const CheckoutFlowContext = createContext<CheckoutFlowContextValue | null>(null);

export function CheckoutFlowProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: CheckoutFlowContextValue;
}) {
  return <CheckoutFlowContext.Provider value={value}>{children}</CheckoutFlowContext.Provider>;
}

export function useCheckoutFlow(): CheckoutFlowContextValue {
  const ctx = useContext(CheckoutFlowContext);
  if (!ctx) {
    throw new Error('useCheckoutFlow CheckoutFlowProvider ichida ishlatilishi kerak');
  }
  return ctx;
}
