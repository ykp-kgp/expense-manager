import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initDb } from '@/db';
import { listCategories, listPaymentMethods } from './queries';
import type { Category, PaymentMethod } from '@/db/schema';

type Ctx = {
  ready: boolean;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  refresh: () => Promise<void>;
  bump: () => void;
  version: number;
};

const DbContext = createContext<Ctx | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [version, setVersion] = useState(0);

  const refresh = async () => {
    const [cats, pms] = await Promise.all([listCategories(), listPaymentMethods()]);
    setCategories(cats);
    setPaymentMethods(pms);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await initDb();
      if (!mounted) return;
      await refresh();
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <DbContext.Provider
      value={{
        ready,
        categories,
        paymentMethods,
        refresh,
        bump: () => setVersion((v) => v + 1),
        version,
      }}
    >
      {children}
    </DbContext.Provider>
  );
}

export function useDb(): Ctx {
  const ctx = useContext(DbContext);
  if (!ctx) {
    return {
      ready: false,
      categories: [],
      paymentMethods: [],
      refresh: async () => undefined,
      bump: () => undefined,
      version: 0,
    };
  }
  return ctx;
}
