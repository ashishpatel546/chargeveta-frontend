'use client';

import { OtpForm } from './otp-form';
import { PasswordForm } from './password-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** The two ways a driver reaches a session directly; the third, a magic link, lives at `/driver/link`. */
export function SignInTabs({ defaultCountry }: { defaultCountry: string }) {
  return (
    <Tabs defaultValue="phone">
      <TabsList className="w-full">
        <TabsTrigger value="phone" className="flex-1">
          Phone
        </TabsTrigger>
        <TabsTrigger value="email" className="flex-1">
          Email
        </TabsTrigger>
      </TabsList>
      <TabsContent value="phone" className="pt-4">
        <OtpForm defaultCountry={defaultCountry} />
      </TabsContent>
      <TabsContent value="email" className="pt-4">
        <PasswordForm />
      </TabsContent>
    </Tabs>
  );
}
