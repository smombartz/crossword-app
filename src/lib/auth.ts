import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== 'google') return false;

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('google_id', account.providerAccountId)
        .single();

      if (!existing) {
        await supabase.from('users').insert({
          id: `user_${nanoid()}`,
          google_id: account.providerAccountId,
          email: user.email,
          display_name: user.name ?? 'Anonymous',
          avatar_url: user.image,
        });
      }

      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        const { data } = await supabase
          .from('users')
          .select('id, display_name, avatar_url')
          .eq('google_id', token.sub)
          .single();

        if (data && session.user) {
          (session.user as Record<string, unknown>).userId = data.id;
          (session.user as Record<string, unknown>).displayName = data.display_name;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
