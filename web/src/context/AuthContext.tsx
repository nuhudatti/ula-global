import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setToken, getToken } from '../lib/api';

export type Role =
  | 'INSTITUTION_ADMIN'
  | 'SUPER_ADMIN'
  | 'FACULTY_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'HOD'
  | 'LECTURER'
  | 'ACADEMIC_RESOURCES_MANAGER'
  | 'STUDENT';

export type User = {
  id: string;
  institutionId?: string;
  institution?: { slug: string; name: string; shortName: string } | null;
  email: string;
  fullName: string;
  matricNumber?: string | null;
  role: Role;
  departmentId: string | null;
  facultyId?: string | null;
  faculty?: { id: string; name: string; code: string } | null;
  bio?: string | null;
  profilePhotoUrl?: string | null;
  bannerUrl?: string | null;
  mustChangePassword?: boolean;
  accountStatus?: string;
  department?: {
    id: string;
    name: string;
    faculty: { id: string; name: string; code: string };
  } | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ user: User; mustChangePassword: boolean }>;
  register: (
    email: string,
    password: string,
    fullName: string,
    departmentId: string,
    matricNumber: string,
  ) => Promise<User>;
  acceptInvite: (inviteToken: string, password: string, otp?: string) => Promise<User>;
  establishSession: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  patchUser: (patch: Partial<User>) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>('/api/auth/me');
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onFocus() {
      if (getToken()) void refresh();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const establishSession = useCallback((token: string, user: User) => {
    setToken(token);
    setUser(user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User; mustChangePassword?: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
    try {
      const me = await api<User>('/api/auth/me');
      setUser(me);
      return {
        user: me,
        mustChangePassword: Boolean(res.mustChangePassword || me.mustChangePassword),
      };
    } catch {
      return {
        user: res.user,
        mustChangePassword: Boolean(res.mustChangePassword || res.user.mustChangePassword),
      };
    }
  }, []);

  const acceptInvite = useCallback(async (inviteToken: string, password: string, otp?: string) => {
    const res = await api<{ token: string; user: User }>('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token: inviteToken, password, otp }),
    });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string, departmentId: string, matricNumber: string) => {
      const res = await api<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName, departmentId, matricNumber }),
      });
      setToken(res.token);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, acceptInvite, establishSession, logout, refresh, patchUser }),
    [user, loading, login, register, acceptInvite, establishSession, logout, refresh, patchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
