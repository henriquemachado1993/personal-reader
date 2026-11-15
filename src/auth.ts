import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createHmac } from "node:crypto";
import { database } from "@/infrastructure/database/client";
import { credentialsSchema } from "@/modules/auth/validation";
import { sessionPredatesPasswordChange } from "@/modules/auth/recovery-token";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success || !process.env.AUTH_SECRET) return null;
        const { email, password } = parsed.data;
        const db = database();
        const key = createHmac("sha256", process.env.AUTH_SECRET)
          .update(email)
          .digest("hex");
        const attempt = await db.loginAttempt.upsert({
          where: { key },
          create: { key },
          update: { count: { increment: 1 } },
        });
        if (Date.now() - attempt.windowStart.getTime() > 15 * 60 * 1000)
          await db.loginAttempt.update({
            where: { key },
            data: { count: 1, windowStart: new Date() },
          });
        else if (attempt.count > 10) return null;
        const user = await db.user.findUnique({ where: { email } });
        const valid = await compare(
          password,
          user?.passwordHash ??
            "$2b$12$5Q5bWZ.5LZyB6Jbg1ZAjAuMGTtVK9YH9rZJ2JhHE0EWP5YPFpkO9C",
        );
        if (!user || !valid || !user.passwordHash) return null;
        await db.loginAttempt.deleteMany({ where: { key } });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id;
      if (!user && token.id) {
        const account = await database().user.findUnique({
          where: { id: String(token.id) },
          select: { passwordChangedAt: true },
        });
        if (
          account &&
          sessionPredatesPasswordChange(token.iat, account.passwordChangedAt)
        )
          return null;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user && token.id) session.user.id = String(token.id);
      return session;
    },
  },
});
