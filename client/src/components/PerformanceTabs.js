import React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { SegmentedLinks } from './ui/Segmented';

// /tests, /test-results and /tests?tab=types read as one "Performance" area.
const PerformanceTabs = () => {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onTypes = pathname === '/tests' && params.get('tab') === 'types';
  return (
    <SegmentedLinks
      label="Performance"
      className="self-start"
      links={[
        { to: '/tests', label: 'Record', active: pathname === '/tests' && !onTypes },
        { to: '/test-results', label: 'Results', active: pathname === '/test-results' },
        { to: '/tests?tab=types', label: 'Test types', active: onTypes }
      ]}
    />
  );
};

export default PerformanceTabs;
