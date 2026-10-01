'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';

/**
 * A password field with a show/hide toggle at its right edge. Everything
 * else — `name`, `id`, `autoComplete`, `required`, `defaultValue` or a
 * controlled `value` — passes straight through to the `Input`, so a form or a
 * server action sees exactly the same field it did before.
 *
 * Whether it is shown lives only in this component's state: it starts hidden
 * on every mount and is never remembered.
 */
function PasswordInput({
  className,
  ref,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  // The caret to put back after the type flips, if the field had focus.
  const selection = React.useRef<[number | null, number | null] | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  React.useLayoutEffect(() => {
    const input = inputRef.current;
    const saved = selection.current;
    selection.current = null;
    if (!input || !saved) return;
    // Some browsers move the caret to the start when `type` changes.
    try {
      input.setSelectionRange(saved[0], saved[1]);
    } catch {
      // Not every input type supports a selection; nothing to restore then.
    }
  }, [visible]);

  function toggle() {
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      selection.current = [input.selectionStart, input.selectionEnd];
    }
    setVisible((shown) => !shown);
  }

  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        // Password managers (Chrome's, LastPass, Bitwarden…) write attributes
        // such as `aria-autocomplete="list"` onto a password field before React
        // hydrates, which React reports as a mismatch. Only this element's own
        // attributes are excused, not its children or the form.
        suppressHydrationWarning
        ref={setRefs}
        type={visible ? 'text' : 'password'}
        className={cn('pr-9', className)}
      />
      <button
        type="button"
        onClick={toggle}
        // Keeps focus (and the caret) in the field when clicked with a
        // mouse; keyboard users still reach the button with Tab.
        onMouseDown={(event) => event.preventDefault()}
        disabled={props.disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-lg outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export { PasswordInput };
