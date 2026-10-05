import { startTransition, type FormEvent } from 'react';

/**
 * React 19 clears every uncontrolled field once a `<form action>` finishes,
 * which wipes the email and password after a refused sign-in. Handling submit
 * ourselves — and calling the action inside a transition, as React would — runs
 * the same action without the reset. Pair it with `action={action}` so the form
 * still works before hydration, and read `pending` from `useActionState`
 * (`useFormStatus` doesn't see a transition started this way).
 */
export function keepFormOnSubmit(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };
}
