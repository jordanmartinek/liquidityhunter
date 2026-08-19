import React from 'react';
import { ResearchProvider } from '@/lib/researchStore';
import Cockpit from './Cockpit';

export default function CockpitPage() {
  return (
    <ResearchProvider>
      <Cockpit />
    </ResearchProvider>
  );
}
