
import { useEffect, useState } from 'react';
import { AuthContext } from './auth-context';
import { supabase } from '../lib/supabase';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Load the existing session
    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error('Session initialization failed:', error);
      }

      const currentSession = data?.session ?? null;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    initializeAuth();

    // Listen for authentication changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Register a new user
  const register = async ({
    fullName,
    username,
    email,
    password,
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  };

  // Login
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  };

  // Logout
  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  };

  // Send password reset email
  const forgotPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      throw error;
    }
  };

  // Update password
  const updatePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      throw error;
    }
  };

  // Values available throughout the application
  const value = {
    user,
    session,
    loading,
    register,
    login,
    logout,
    forgotPassword,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
