import { redirect } from 'next/navigation';

/**
 * The root has no content of its own. `/dashboard` resolves the role once
 * identity has loaded; an unauthenticated visitor is bounced to /login from
 * there (§9.1).
 */
export default function Home() {
  redirect('/dashboard');
}
