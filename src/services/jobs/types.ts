export type JobExtractionInput = {
  authorName: string;
  content: string;
  ocrText: string | null;
};

export type ExtractedRole = {
  company: string | null;
  role: string;
  location: string | null;
  remoteStatus: string | null;
  seniority: string | null;
  experience: string | null;
  skills: string[];
};

export type JobExtractionResult = {
  /** grill G1: only "someone is hiring" posts get roles — job seekers/recruiter spam without a named role don't. */
  isHiringPost: boolean;
  roles: ExtractedRole[];
};
