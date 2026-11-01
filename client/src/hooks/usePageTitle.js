import { useEffect } from 'react';

const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} | AttendTrack` : 'AttendTrack';
  }, [title]);
};

export default usePageTitle;
