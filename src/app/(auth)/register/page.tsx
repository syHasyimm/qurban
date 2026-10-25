import { redirect } from "next/navigation";
// Public self-registration has no frontend. Signup API hardening is a backend task.
export default function RegisterPage() {
  redirect("/login");
}
