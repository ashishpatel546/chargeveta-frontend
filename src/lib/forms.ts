/**
 * What a form action hands back to its form.
 *
 * Kept out of the `'use server'` files on purpose: everything exported from one
 * of those becomes a callable server action, and a type is not that.
 */
export interface FormState {
  /** Shown above the form. Absent when nothing has gone wrong yet. */
  error?: string;
  /** Shown when the action succeeded and the page stays put. */
  message?: string;
}

export const EMPTY_FORM: FormState = {};
