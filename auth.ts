import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/app/lib/supabase';
import type { User } from '@/app/lib/definitions';

async function getUser(email: string): Promise<User | undefined> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, password')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user:', error);
    return undefined;
  }
  return data ?? undefined;
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        return token;
      }
      // Backfill `id` for sessions issued before this callback existed.
      if (!token.id && token.email) {
        const existing = await getUser(token.email);
        if (existing) token.id = existing.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await getUser(email);
        if (!user) return null;

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (passwordsMatch) {
          return { id: user.id, name: user.name, email: user.email };
        }

        return null;
      },
    }),
  ],
});
