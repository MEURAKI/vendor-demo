// app/auth/login/page.tsx
import LoginForm from "../../../../sections/auth/login-form";

export default function LoginPage() {
  return <LoginForm />; // client component inside server page is fine
}
