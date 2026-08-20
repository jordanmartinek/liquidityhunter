import React from 'react';
import { ResearchProvider } from '@/lib/researchStore';
import ResearchCockpit from './ResearchCockpit';

export default function ResearchPage() {
  return (
    <ResearchProvider>
      <ResearchCockpit />
    </ResearchProvider>
  );
}
