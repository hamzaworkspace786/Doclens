import { createAuthClient } from "better-auth/react";

// Same-origin by default, so no base URL is needed.
export const authClient = createAuthClient();
