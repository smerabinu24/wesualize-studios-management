import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h sessions
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { employee: true },
        });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        // Audit successful login (fire-and-forget).
        prisma.activityLog
          .create({ data: { userId: user.id, action: "auth.login", entityType: "User", entityId: user.id } })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.employee?.name ?? user.email,
          employeeId: user.employee?.id ?? null,
          avatarUrl: user.employee?.avatarUrl ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { role: Role; employeeId: string | null; avatarUrl: string | null };
        token.role = u.role;
        token.employeeId = u.employeeId;
        token.avatarUrl = u.avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as Role;
        session.user.employeeId = (token.employeeId as string | null) ?? null;
        session.user.avatarUrl = (token.avatarUrl as string | null) ?? null;
      }
      return session;
    },
  },
};
