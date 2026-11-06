/** Solo routes, mounted under /solo by the mode registry. */
export const soloPaths = {
  landing: '/solo',
  file: '/solo/file',
  stake: '/solo/stake',
  trial: (caseNumber: string | number) => `/solo/trial/${caseNumber}`,
  docket: '/solo/docket',
  case: (id: string) => `/solo/case/${id}`,
} as const;
