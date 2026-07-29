import type { AuthError, Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import { warmTodayRates } from '../lib/fx';
import { supabase } from '../lib/supabase';

type AuthResult = {
  error: AuthError | null;
};

type SignUpResult = AuthResult & {
  user: User | null;
  session: Session | null;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionUserId = session?.user.id;

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        console.error('Unable to restore the Supabase session:', error.message);
      }

      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      return;
    }

    void warmTodayRates().catch((error: unknown) => {
      console.error('Unable to warm FX rates after sign-in:', error);
    });
  }, [sessionUserId]);

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(
    email: string,
    password: string,
  ): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error, user: data.user, session: data.session };
  }

  async function signOut(): Promise<AuthResult> {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
