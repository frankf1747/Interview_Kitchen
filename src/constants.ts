import { SectionType } from './types';

export const SECTION_DETAILS: Record<SectionType, { title: string; description: string; icon: string }> = {
  [SectionType.BEHAVIORAL]: {
    title: 'Behavioral',
    description: 'Questions assessing your soft skills, past behavior, and cultural fit.',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  [SectionType.TECHNICAL]: {
    title: 'Technical',
    description: 'Questions assessing your hard skills, coding, or domain-specific knowledge.',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  [SectionType.RELEVANCE]: {
    title: 'Resume Relevance',
    description: 'Deep dives into specific experiences and bullet points on your resume.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  [SectionType.ROLE_SPECIFIC]: {
    title: 'Role Specific',
    description: 'Questions specifically tailored to the unique demands of the target job description.',
    icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
};
