export const ATTORNEY_IMPORT_SOURCE = 'ATTORNEY_AUTOMATION' as const;

export interface RemoteAttorneyRecord {
  id: string;
  courtListenerId: number | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  website: string | null;
  linkedin: string | null;
  barNumber: string | null;
  photo: string | null;
  yearsExperience: number | null;
  languages: string[] | null;
  practiceAreas: string[] | null;
  professionalSummary: string | null;
  biography: string | null;
  courts: string[] | null;
  districts: string[] | null;
  states: string[] | null;
  contactRaw: string | null;
  totalCases: number | null;
  wonCases: number | null;
  lostCases: number | null;
  pendingCases: number | null;
  winRate: number | null;
  lastCaseDate: string | null;
}

export interface RemoteAttorneyPage {
  data: RemoteAttorneyRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AttorneyImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}
