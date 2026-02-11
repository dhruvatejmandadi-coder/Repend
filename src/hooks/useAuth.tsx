import * as React from "react";
import { createContext, useContext, useState, ReactNode } from "react";

interface MockUser {
  id: string;
  email: string;
  user_metadata: { full_name?: string; role?: string };
}

interface AuthContextType {
  user: MockUser | null;
  session: unknown;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { full_name?: string; role?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);

  const signUp = async (email: string, password: string, metadata?: { full_name?: string; role?: string }) => {
    const mockUser: MockUser = {
      id: crypto.randomUUID(),
      email,
      user_metadata: { full_name: metadata?.full_name || "", role: metadata?.role || "learner" },
    };
    setUser(mockUser);
    return { error: null };
  };

  const signIn = async (email: string, _password: string) => {
    const mockUser: MockUser = {
      id: crypto.randomUUID(),
      email,
      user_metadata: { full_name: "", role: "learner" },
    };
    setUser(mockUser);
    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session: user ? {} : null, loading: false, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
