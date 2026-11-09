import { redirect } from "next/navigation";

// The workspace is the home of the app. proxy.ts sends signed-out visitors to /login.
export default function Home() {
  redirect("/workspace");
}
