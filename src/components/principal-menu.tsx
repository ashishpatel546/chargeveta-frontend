'use client';

import { UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Principal } from '@/lib/api/types';
import { signOut } from '@/lib/server/auth';

export function PrincipalMenu({ principal }: { principal: Principal }) {
  const name = principal.kind === 'user' ? principal.email : principal.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Your account" />}
      >
        <UserIcon className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-muted-foreground text-xs capitalize">
              {principal.role}
            </p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {principal.kind === 'user' ? (
          <DropdownMenuItem render={<Link href="/change-password" />}>
            Change password
          </DropdownMenuItem>
        ) : null}
        <form action={signOut}>
          <DropdownMenuItem
            nativeButton
            render={<button type="submit" className="w-full text-left" />}
          >
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
