// Client-side Better-Auth bindings. Thin re-export of the React helpers.
// The auth handler itself is server-side; this client is purely for forms
// and the sign-out button.

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // Same-origin by default. If you deploy behind a custom domain, set
  // NEXT_PUBLIC_APP_URL in `.env.local` and pass it here.
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;