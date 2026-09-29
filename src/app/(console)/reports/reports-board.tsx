'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailabilityReportPanel } from './availability-report';
import { FreeChargingReportPanel } from './free-charging-report';
import { SessionReportPanel } from './session-report';

/**
 * The reports, on one screen.
 *
 * Each keeps its own period, and neither is fetched until its tab has been
 * opened — a report is a scan over a range of days, so asking for both at once
 * would cost twice as much as anyone is reading.
 */
export function ReportsBoard() {
  const [tab, setTab] = useState('sessions');

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sessions and availability over a period, and what free charging cost and who owes it, as the rows behind them. Every report downloads as CSV."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="free-charging">Free charging</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="pt-4">
          {tab === 'sessions' ? <SessionReportPanel /> : null}
        </TabsContent>
        <TabsContent value="availability" className="pt-4">
          {tab === 'availability' ? <AvailabilityReportPanel /> : null}
        </TabsContent>
        <TabsContent value="free-charging" className="pt-4">
          {tab === 'free-charging' ? <FreeChargingReportPanel /> : null}
        </TabsContent>
      </Tabs>
    </>
  );
}
