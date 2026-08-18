import React from 'react';
import { CockpitProvider } from '@/lib/cockpitStore';
import Cockpit from './Cockpit';

export default function CockpitPage() {
  return (
    <CockpitProvider>
      <Cockpit />
    </CockpitProvider>
  );
}
