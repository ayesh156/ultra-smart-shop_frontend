import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api, {
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  setCachedUser,
  getCachedUser,
  setCachedShop,
  getCachedShop,
  clearAllTokens,
  isTokenExpired,
} from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Shop {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  // Barcode settings
  barcodePrefix?: string;
  barcodeLength?: number;
  barcodeNumbersOnly?: boolean;
  // Cashier permissions (configurable by admin)
  cashierCanCreateProducts?: boolean;
  cashierCanEditProducts?: boolean;
  cashierCanCreateCustomers?: boolean;
  cashierCanEditCustomers?: boolean;
  cashierCanCreateSuppliers?: boolean;
  cashierCanEditSuppliers?: boolean;
  cashierCanViewReports?: boolean;
  cashierCanAdjustStock?: boolean;
  cashierCanCreateWholesale?: boolean;
}

interface AuthContextType {
  user: User | null;
  shop: Shop | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Check if the current user can perform an action based on role + shop permissions */
  can: (action: CashierAction) => boolean;
}

/** Actions that can be restricted for cashiers via Settings → Staff Access */
type CashierAction =
  | 'createProducts' | 'editProducts' | 'deleteProducts'
  | 'createCustomers' | 'editCustomers' | 'deleteCustomers'
  | 'createSuppliers' | 'editSuppliers' | 'deleteSuppliers'
  | 'viewReports' | 'adjustStock' | 'createWholesale'
  | 'voidInvoices' | 'manageUsers' | 'manageShop'
  | 'deleteCategories' | 'deleteBrands' | 'editCategories' | 'editBrands';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null && getAccessToken() !== null;

  // Listen for silent logout event from api interceptor (when session expires mid-use)
  useEffect(() => {
    const handleLogoutEvent = () => {
      setUser(null);
      setShop(null);
      clearAllTokens();
    };

    window.addEventListener('auth:logout', handleLogoutEvent as EventListener);
    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent as EventListener);
    };
  }, []);

  // Restore session on mount — instant from cache, async validation in background
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = getAccessToken();
        const cachedUser = getCachedUser() as User | null;
        const cachedShop = getCachedShop() as Shop | null;

        // No token at all — not logged in
        if (!token) {
          setIsLoading(false);
          return;
        }

        // FAST PATH: token not expired + cached data → instant restore
        if (cachedUser && !isTokenExpired(token)) {
          setUser(cachedUser);
          if (cachedShop) setShop(cachedShop);
          setIsLoading(false);

          // Background: validate with server (non-blocking)
          api.get('/auth/me').then(({ data }) => {
            if (data.success && data.data.user) {
              setUser(data.data.user);
              setCachedUser(data.data.user);
              if (data.data.shop) {
                setShop(data.data.shop);
                setCachedShop(data.data.shop);
              }
            }
          }).catch(() => {
            // Server validation failed in background — token was valid client-side, keep going
          });
          return;
        }

        // SLOW PATH: token expired → try refresh
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          try {
            const { data } = await api.post('/auth/refresh', { refreshToken });
            if (data.success && data.data.accessToken) {
              setAccessToken(data.data.accessToken);
              if (data.data.refreshToken) setRefreshToken(data.data.refreshToken);

              const newUser = data.data.user;
              const newShop = data.data.shop;
              setUser(newUser);
              setCachedUser(newUser);
              if (newShop) {
                setShop(newShop);
                setCachedShop(newShop);
              }
              setIsLoading(false);
              return;
            }
          } catch {
            // Refresh failed — session truly expired
          }
        }

        // All restore attempts failed — clean up silently (redirects to login via isAuthenticated=false)
        clearAllTokens();
        setUser(null);
        setShop(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.success) {
      setAccessToken(data.data.accessToken);
      if (data.data.refreshToken) setRefreshToken(data.data.refreshToken);
      setCachedUser(data.data.user);
      setCachedShop(data.data.shop);
      setUser(data.data.user);
      setShop(data.data.shop);
    }
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearAllTokens();
    setUser(null);
    setShop(null);
  }, []);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isCashier = user?.role === 'CASHIER';

  /** Permission checker — admins always have full access, cashiers check shop permissions */
  const can = useCallback((action: CashierAction): boolean => {
    if (!user) return false;
    // ADMIN and SUPER_ADMIN always have full access
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
    // Cashier — hard-blocked actions (never configurable)
    const hardBlocked: CashierAction[] = [
      'deleteProducts', 'deleteCustomers', 'deleteSuppliers',
      'deleteCategories', 'deleteBrands',
      'voidInvoices', 'manageUsers', 'manageShop',
    ];
    if (hardBlocked.includes(action)) return false;
    // Cashier — configurable permissions from shop settings
    const permissionMap: Record<string, boolean | undefined> = {
      createProducts: shop?.cashierCanCreateProducts,
      editProducts: shop?.cashierCanEditProducts,
      createCustomers: shop?.cashierCanCreateCustomers,
      editCustomers: shop?.cashierCanEditCustomers,
      createSuppliers: shop?.cashierCanCreateSuppliers,
      editSuppliers: shop?.cashierCanEditSuppliers,
      viewReports: shop?.cashierCanViewReports,
      adjustStock: shop?.cashierCanAdjustStock,
      createWholesale: shop?.cashierCanCreateWholesale,
      editCategories: shop?.cashierCanEditProducts, // Categories tied to product management
      editBrands: shop?.cashierCanEditProducts,     // Brands tied to product management
    };
    return permissionMap[action] ?? true; // Default to allowed if undefined
  }, [user, shop]);

  return (
    <AuthContext.Provider value={{ user, shop, isAuthenticated, isLoading, isAdmin, isCashier, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export type { User, Shop, CashierAction };

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
